// Routes для работы с рекламными аккаунтами
// CRUD операции и синхронизация данных

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, checkAccountOwnership } from '../middleware/auth.js';
import { syncAccountData } from '../services/facebook.js';

const router = express.Router();
const prisma = new PrismaClient();

// Все routes требуют аутентификации
router.use(authenticate);

/**
 * GET /api/accounts
 * Получить список Facebook-подключений пользователя и их рекламных аккаунтов
 */
router.get('/', async (req, res) => {
  try {
    const connections = await prisma.facebookConnection.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        adAccounts: {
          include: {
            _count: {
              select: {
                campaigns: true,
                rules: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ connections });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get accounts',
    });
  }
});

/**
 * GET /api/accounts/:accountId
 * Получить детальную информацию об аккаунте
 */
router.get('/:accountId', checkAccountOwnership, async (req, res) => {
  try {
    const account = await prisma.adAccount.findUnique({
      where: { id: req.adAccount.id },
      include: {
        campaigns: {
          orderBy: { createdTime: 'desc' },
        },
        _count: {
          select: {
            rules: true,
            campaigns: true,
          },
        },
      },
    });

    res.json({ account });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get account',
    });
  }
});

/**
 * POST /api/accounts/:accountId/sync
 * Синхронизировать данные аккаунта с Facebook
 */
router.post('/:accountId/sync', checkAccountOwnership, async (req, res) => {
  try {
    const result = await syncAccountData(req.adAccount.id);

    res.json({
      message: 'Account synced successfully',
      stats: result,
    });
  } catch (error) {
    console.error('Sync account error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to sync account',
    });
  }
});

/**
 * GET /api/accounts/:accountId/stats
 * Получить статистику аккаунта
 */
router.get('/:accountId/stats', checkAccountOwnership, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    const metrics = await prisma.metricSnapshot.findMany({
      where: {
        adAccountId: req.adAccount.id,
        entityType: 'account',
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const aggregated = metrics.reduce(
      (acc, m) => {
        acc.totalSpend += m.spend;
        acc.totalImpressions += m.impressions;
        acc.totalClicks += m.clicks;
        acc.totalLeads += m.leads;
        acc.totalConversions += m.conversions;
        acc.totalRevenue += m.revenue;
        acc.totalApproves += m.approves;
        return acc;
      },
      {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalLeads: 0,
        totalConversions: 0,
        totalRevenue: 0,
        totalApproves: 0,
      }
    );

    aggregated.avgCTR =
      aggregated.totalImpressions > 0
        ? (aggregated.totalClicks / aggregated.totalImpressions) * 100
        : 0;

    aggregated.avgCPC =
      aggregated.totalClicks > 0
        ? aggregated.totalSpend / aggregated.totalClicks
        : 0;

    aggregated.avgCPL =
      aggregated.totalLeads > 0
        ? aggregated.totalSpend / aggregated.totalLeads
        : 0;

    aggregated.roas =
      aggregated.totalSpend > 0
        ? aggregated.totalRevenue / aggregated.totalSpend
        : 0;

    res.json({
      period: `${days} days`,
      metrics: aggregated,
      daily: metrics,
    });
  } catch (error) {
    console.error('Get account stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get account stats',
    });
  }
});

/**
 * DELETE /api/accounts/:accountId
 * Удалить один рекламный аккаунт и все связанные данные
 */
router.delete('/:accountId', checkAccountOwnership, async (req, res) => {
  try {
    const adAccountId = req.adAccount.id;
    const facebookConnectionId = req.adAccount.facebookConnectionId;

    await prisma.$transaction(async (tx) => {
      await tx.ruleExecution.deleteMany({
        where: { adAccountId },
      });

      await tx.rule.deleteMany({
        where: { adAccountId },
      });

      await tx.aIRecommendation.deleteMany({
  where: { adAccountId },
});

await tx.aIAction.deleteMany({
  where: { adAccountId },
});

      await tx.approveData.deleteMany({
        where: { adAccountId },
      });

      await tx.metricSnapshot.deleteMany({
        where: { adAccountId },
      });

      await tx.ad.deleteMany({
        where: { adAccountId },
      });

      await tx.adSet.deleteMany({
        where: { adAccountId },
      });

      await tx.campaign.deleteMany({
        where: { adAccountId },
      });

      await tx.adAccount.delete({
        where: { id: adAccountId },
      });
    });

    const remainingAccounts = await prisma.adAccount.count({
      where: { facebookConnectionId },
    });

    res.json({
      message: 'Account deleted successfully',
      deletedAccountId: req.adAccount.accountId,
      connectionEmpty: remainingAccounts === 0,
      remainingAccounts,
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to delete account',
    });
  }
});

/**
 * DELETE /api/connections/:connectionId
 * Удалить Facebook-подключение и все связанные рекламные аккаунты
 */
router.delete('/connections/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params

    if (!connectionId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Connection ID required',
      })
    }

    const connection = await prisma.facebookConnection.findFirst({
      where: {
        id: connectionId,
        userId: req.user.id,
      },
      include: {
        adAccounts: {
          select: { id: true, accountId: true, name: true },
        },
      },
    })

    if (!connection) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Facebook connection not found or access denied',
      })
    }

    const adAccountIds = connection.adAccounts.map((a) => a.id)

    await prisma.$transaction(async (tx) => {
      if (adAccountIds.length > 0) {
        await tx.ruleExecution.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.rule.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.aIRecommendation.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.aIAction.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.approveData.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.metricSnapshot.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.ad.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.adSet.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.campaign.deleteMany({
          where: { adAccountId: { in: adAccountIds } },
        })

        await tx.adAccount.deleteMany({
          where: { id: { in: adAccountIds } },
        })
      }

      await tx.facebookConnection.delete({
        where: { id: connectionId },
      })
    })

    res.json({
      message: 'Facebook connection deleted successfully',
      deletedConnectionId: connectionId,
      deletedAccounts: connection.adAccounts.length,
    })
  } catch (error) {
    console.error('Delete connection error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to delete Facebook connection',
    })
  }
})

export default router;
