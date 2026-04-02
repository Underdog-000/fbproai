// Главный файл сервера Facebook Ad Manager
// Точка входа, настройка Express, middleware, routes, cron

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import config from './config/index.js';
import ruleTemplateRoutes from './routes/rule-templates.js';
import campaignRuleRoutes from './routes/campaign-rules.js';

import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import rulesRoutes from './routes/rules.js';

import { syncAccountData, updateEntityStatus } from './services/facebook.js';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/rule-templates', ruleTemplateRoutes);
app.use('/api/campaign-rules', campaignRuleRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
});

async function evaluateCampaignRules(targetAdAccountIds = null) {
  console.log('[CRON] Starting campaign rules check...');

  try {
    const campaignRules = await prisma.campaignRule.findMany({
      where: {
        isActive: true,
        ...(targetAdAccountIds?.length ? { adAccountId: { in: targetAdAccountIds } } : {}),
      },
      include: {
        adAccount: true,
        ruleTemplate: true,
      },
    });

    for (const campaignRule of campaignRules) {
      try {
        const cooldownMinutes = campaignRule.ruleTemplate?.cooldownMinutes || 60;

        if (campaignRule.lastExecutedAt) {
          const cooldownEnd = new Date(
            campaignRule.lastExecutedAt.getTime() + cooldownMinutes * 60 * 1000
          );

          if (new Date() < cooldownEnd) {
            console.log(`[CRON] CampaignRule ${campaignRule.id} still in cooldown, skipping`);

            await prisma.campaignRule.update({
              where: { id: campaignRule.id },
              data: {
                lastEvaluationAt: new Date(),
                lastResult: 'cooldown',
              },
            });

            continue;
          }
        }

        const campaign = await prisma.campaign.findFirst({
          where: {
            adAccountId: campaignRule.adAccountId,
            campaignId: campaignRule.campaignId,
          },
        });

        if (!campaign) {
          await prisma.campaignRule.update({
            where: { id: campaignRule.id },
            data: {
              lastEvaluationAt: new Date(),
              lastResult: 'campaign_not_found',
            },
          });
          continue;
        }

        let entities = [];

        if (campaignRule.actionScope === 'adset') {
          entities = await prisma.adSet.findMany({
            where: {
              adAccountId: campaignRule.adAccountId,
              campaignId: campaign.id,
            },
          });
        } else if (campaignRule.actionScope === 'ad') {
          const adSets = await prisma.adSet.findMany({
            where: {
              adAccountId: campaignRule.adAccountId,
              campaignId: campaign.id,
            },
            select: { id: true },
          });

          const adSetIds = adSets.map((item) => item.id);

          entities = adSetIds.length
            ? await prisma.ad.findMany({
                where: {
                  adAccountId: campaignRule.adAccountId,
                  adSetId: { in: adSetIds },
                },
              })
            : [];
        } else {
          await prisma.campaignRule.update({
            where: { id: campaignRule.id },
            data: {
              lastEvaluationAt: new Date(),
              lastResult: 'unsupported_scope',
            },
          });
          continue;
        }

        if (!entities.length) {
          await prisma.campaignRule.update({
            where: { id: campaignRule.id },
            data: {
              lastEvaluationAt: new Date(),
              lastResult: 'no_entities',
            },
          });
          continue;
        }

        let actionsTaken = 0;

        for (const entity of entities) {
          const entityType = campaignRule.actionScope;
          const entityId = entityType === 'adset' ? entity.adSetId : entity.adId;

          const metrics = await prisma.metricSnapshot.findFirst({
            where: {
              adAccountId: campaignRule.adAccountId,
              entityType,
              entityId,
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          });

          if (!metrics) {
            console.log(`[CRON] No metrics for CampaignRule ${campaignRule.id} on ${entityType} ${entityId}`);
            continue;
          }

          const realCpl = Number(metrics.cpl || 0);
          const thresholdCpl = Number(campaignRule.calculatedCplThreshold || 0);

          let shouldAct = false;
          if (campaignRule.actionType === 'pause') {
            shouldAct = realCpl > thresholdCpl;
          } else if (campaignRule.actionType === 'enable') {
            shouldAct = realCpl <= thresholdCpl;
          }

          console.log('[CRON] Rule evaluation:', JSON.stringify({
            campaignRuleId: campaignRule.id,
            campaignId: campaignRule.campaignId,
            entityType,
            entityId,
            entityName: entity.name,
            currentStatus: entity.status,
            metricDate: metrics.date,
            realCpl,
            thresholdCpl,
            actionType: campaignRule.actionType,
            shouldAct,
          }));

          if (!shouldAct) {
            continue;
          }

          const targetStatus = campaignRule.actionType === 'pause' ? 'PAUSED' : 'ACTIVE';

          if (entity.status === targetStatus) {
            console.log(`[CRON] Entity ${entityType} ${entityId} already has target status ${targetStatus}`);
            continue;
          }

          try {
            console.log('[CRON] Executing action:', JSON.stringify({
              campaignRuleId: campaignRule.id,
              entityType,
              entityId,
              entityName: entity.name,
              currentStatus: entity.status,
              targetStatus,
              realCpl,
              thresholdCpl,
            }));

            const updateResult = await updateEntityStatus(
              entityType,
              entityId,
              targetStatus,
              campaignRule.adAccountId
            );

            console.log('[CRON] Action verified:', JSON.stringify({
              campaignRuleId: campaignRule.id,
              entityType,
              entityId,
              entityName: entity.name,
              updateResult,
            }));

            await prisma.campaignRuleExecution.create({
              data: {
                campaignRuleId: campaignRule.id,
                adAccountId: campaignRule.adAccountId,
                campaignId: campaignRule.campaignId,
                entityType,
                entityId,
                entityName: entity.name,
                realCpl,
                thresholdCpl,
                actionTaken: campaignRule.actionType,
                result: 'success',
                details: JSON.stringify({
                  metricDate: metrics.date,
                  spend: metrics.spend,
                  leads: metrics.leads,
                  cpl: metrics.cpl,
                  requestedStatus: targetStatus,
                  verifiedStatus: updateResult?.status || null,
                  verifiedEffectiveStatus: updateResult?.effectiveStatus || null,
                  apiResponse: updateResult?.apiResponse || null,
                }),
              },
            });

            actionsTaken += 1;
          } catch (error) {
            console.error(
              `[CRON] Failed to execute campaign rule ${campaignRule.id} on ${entityType} ${entityId}:`,
              error.message
            );

            await prisma.campaignRuleExecution.create({
              data: {
                campaignRuleId: campaignRule.id,
                adAccountId: campaignRule.adAccountId,
                campaignId: campaignRule.campaignId,
                entityType,
                entityId,
                entityName: entity.name,
                realCpl,
                thresholdCpl,
                actionTaken: campaignRule.actionType,
                result: 'failed',
                details: error.message,
              },
            });
          }
        }

        await prisma.campaignRule.update({
          where: { id: campaignRule.id },
          data: {
            lastEvaluationAt: new Date(),
            lastExecutedAt: actionsTaken > 0 ? new Date() : campaignRule.lastExecutedAt,
            lastResult: actionsTaken > 0 ? `actions_${actionsTaken}` : 'no_action',
          },
        });
      } catch (error) {
        console.error(`[CRON] Failed to process campaign rule ${campaignRule.id}:`, error.message);

        await prisma.campaignRule.update({
          where: { id: campaignRule.id },
          data: {
            lastEvaluationAt: new Date(),
            lastResult: `error:${error.message}`,
          },
        }).catch(() => {});
      }
    }

    console.log('[CRON] Campaign rules check completed');
  } catch (error) {
    console.error('[CRON] Campaign rules check failed:', error);
  }
}

async function runUnifiedDataCycle() {
  console.log('[CRON] Starting unified data cycle...');

  try {
    const accounts = await prisma.adAccount.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'asc' },
    });

    const syncedAccountIds = [];

    for (const account of accounts) {
      try {
        console.log(`[CRON] Syncing account: ${account.accountId}`);
        const stats = await syncAccountData(account.id);
        syncedAccountIds.push(account.id);
        console.log('[CRON] Sync completed:', JSON.stringify({
          adAccountId: account.id,
          accountId: account.accountId,
          stats,
        }));
      } catch (error) {
        console.error(`[CRON] Failed to sync account ${account.accountId}:`, error.message);
      }
    }

    if (syncedAccountIds.length) {
      await evaluateCampaignRules(syncedAccountIds);
    } else {
      console.log('[CRON] No accounts synced successfully, rules check skipped');
    }

    console.log('[CRON] Unified data cycle completed');
  } catch (error) {
    console.error('[CRON] Unified data cycle failed:', error);
  }
}

cron.schedule(config.cron.unifiedDataCycle, async () => {
  await runUnifiedDataCycle();
});

cron.schedule(config.cron.tokenCheck, async () => {
  console.log('[CRON] Starting token check...');

  try {
    const connections = await prisma.facebookConnection.findMany({
      where: { status: 'active' },
      include: {
        adAccounts: {
          select: { accountId: true },
        },
      },
    });

    const warningThreshold = 7 * 24 * 60 * 60 * 1000;

    for (const connection of connections) {
      const timeUntilExpiry = connection.tokenExpiresAt.getTime() - Date.now();

      if (timeUntilExpiry < 0) {
        console.log(`[CRON] Token expired for connection ${connection.facebookUserId}`);

        await prisma.facebookConnection.update({
          where: { id: connection.id },
          data: { status: 'expired' },
        });
      } else if (timeUntilExpiry < warningThreshold) {
        console.log(`[CRON] Token expiring soon for connection ${connection.facebookUserId}`);
      }
    }

    console.log('[CRON] Token check completed');
  } catch (error) {
    console.error('[CRON] Token check failed:', error);
  }
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║        Facebook Ad Manager Server              ║
║════════════════════════════════════════════════║
║  Environment: ${config.nodeEnv.padEnd(30)}║
║  Port: ${String(PORT).padEnd(37)}║
║  API: http://localhost:${PORT}/api${' '.repeat(17)}║
╚════════════════════════════════════════════════╝
  `);

  console.log('Cron jobs scheduled:');
  console.log(`  - Unified data cycle: ${config.cron.unifiedDataCycle}`);
  console.log(`  - AI analysis: ${config.cron.aiAnalysis}`);
  console.log(`  - Token check: ${config.cron.tokenCheck}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
