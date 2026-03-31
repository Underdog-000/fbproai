// Главный файл сервера Facebook Ad Manager
// Точка входа, настройка Express, middleware, routes, cron

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import config from './config/index.js';

// Routes
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import rulesRoutes from './routes/rules.js';

// Services
import { syncAccountData, updateEntityStatus } from './services/facebook.js';

// Инициализация
const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Логирование запросов в development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/rules', rulesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
});

// ============================================
// CRON задачи
// ============================================

/**
 * Обновление статистики
 * Запускается каждые 6 часов
 */
cron.schedule(config.cron.statsUpdate, async () => {
  console.log('[CRON] Starting stats update...');
  
  try {
    const accounts = await prisma.adAccount.findMany({
      where: { status: 'active' },
    });
    
    for (const account of accounts) {
      try {
        console.log(`[CRON] Syncing account: ${account.accountId}`);
        const stats = await syncAccountData(account.id);
        console.log(`[CRON] Synced:`, stats);
      } catch (error) {
        console.error(`[CRON] Failed to sync account ${account.accountId}:`, error.message);
      }
    }
    
    console.log('[CRON] Stats update completed');
  } catch (error) {
    console.error('[CRON] Stats update failed:', error);
  }
});

/**
 * Проверка правил автоматизации
 * Запускается каждые 30 минут
 */
cron.schedule(config.cron.rulesCheck, async () => {
  console.log('[CRON] Starting rules check...');
  
  try {
    const rules = await prisma.rule.findMany({
      where: { isActive: true },
      include: { adAccount: true },
    });
    
    for (const rule of rules) {
      try {
        // Проверяем cooldown
        if (rule.lastExecutedAt) {
          const cooldownEnd = new Date(rule.lastExecutedAt.getTime() + rule.cooldownMinutes * 60 * 1000);
          if (new Date() < cooldownEnd) {
            console.log(`[CRON] Rule ${rule.id} still in cooldown, skipping`);
            continue;
          }
        }
        
        // Получаем метрики сущности
        const condition = JSON.parse(rule.condition);
        const entityType = rule.entityType;
        
        // Получаем все сущности данного типа
        let entities;
        if (entityType === 'ad') {
          entities = await prisma.ad.findMany({
            where: { adAccountId: rule.adAccountId },
          });
        } else if (entityType === 'adset') {
          entities = await prisma.adSet.findMany({
            where: { adAccountId: rule.adAccountId },
          });
        } else if (entityType === 'campaign') {
          entities = await prisma.campaign.findMany({
            where: { adAccountId: rule.adAccountId },
          });
        }
        
        // Проверяем каждую сущность
        for (const entity of entities) {
          const entityId = entity[entityType === 'ad' ? 'adId' : entityType === 'adset' ? 'adSetId' : 'campaignId'];
          
          // Получаем последние метрики
          const metrics = await prisma.metricSnapshot.findFirst({
            where: {
              adAccountId: rule.adAccountId,
              entityType,
              entityId,
            },
            orderBy: { date: 'desc' },
          });
          
          if (!metrics) continue;
          
          // Проверяем условие
          let conditionMet = false;
          const field = condition.field;
          const operator = condition.operator;
          const value = condition.value;
          const metricValue = metrics[field];
          
          if (operator === 'greater_than') {
            conditionMet = metricValue > value;
          } else if (operator === 'less_than') {
            conditionMet = metricValue < value;
          } else if (operator === 'equals') {
            conditionMet = metricValue === value;
          }
          
          // Проверяем дополнительное условие (если есть)
          if (conditionMet && condition.additionalCondition) {
            const addField = condition.additionalCondition.field;
            const addOperator = condition.additionalCondition.operator;
            const addValue = condition.additionalCondition.value;
            const addMetricValue = metrics[addField];
            
            if (addOperator === 'equals') {
              conditionMet = addMetricValue === addValue;
            } else if (addOperator === 'greater_than') {
              conditionMet = addMetricValue > addValue;
            } else if (addOperator === 'less_than') {
              conditionMet = addMetricValue < addValue;
            }
          }
          
          // Выполняем действие если условие выполнено
          if (conditionMet) {
            const action = rule.action;
            
            // Проверяем, применимо ли действие
            if (action === 'pause' && entity.status === 'PAUSED') {
              console.log(`[CRON] Entity ${entityId} already paused, skipping`);
              continue;
            }
            if (action === 'enable' && entity.status === 'ACTIVE') {
              console.log(`[CRON] Entity ${entityId} already active, skipping`);
              continue;
            }
            
            console.log(`[CRON] Rule ${rule.id}: ${action} ${entityType} ${entityId}`);
            
            try {
              await updateEntityStatus(entityType, entityId, action === 'pause' ? 'PAUSED' : 'ACTIVE', rule.adAccountId);
              
              // Логируем выполнение
              await prisma.ruleExecution.create({
                data: {
                  ruleId: rule.id,
                  adAccountId: rule.adAccountId,
                  entityType,
                  entityId,
                  entityName: entity.name,
                  conditionMet: true,
                  actionTaken: action,
                  result: 'success',
                  details: JSON.stringify({ metrics, condition }),
                },
              });
              
              // Обновляем lastExecutedAt
              await prisma.rule.update({
                where: { id: rule.id },
                data: { lastExecutedAt: new Date() },
              });
              
            } catch (error) {
              console.error(`[CRON] Failed to execute action:`, error.message);
              
              await prisma.ruleExecution.create({
                data: {
                  ruleId: rule.id,
                  adAccountId: rule.adAccountId,
                  entityType,
                  entityId,
                  entityName: entity.name,
                  conditionMet: true,
                  actionTaken: action,
                  result: 'failed',
                  details: error.message,
                },
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`[CRON] Failed to process rule ${rule.id}:`, error.message);
      }
    }
    
    console.log('[CRON] Rules check completed');
  } catch (error) {
    console.error('[CRON] Rules check failed:', error);
  }
});

/**
 * Проверка токенов
 * Запускается раз в день в 9:00
 */
cron.schedule(config.cron.tokenCheck, async () => {
  console.log('[CRON] Starting token check...');
  
  try {
    const accounts = await prisma.adAccount.findMany({
      where: { status: 'active' },
    });
    
    const warningThreshold = 7 * 24 * 60 * 60 * 1000; // 7 дней
    
    for (const account of accounts) {
      const timeUntilExpiry = account.tokenExpiresAt.getTime() - Date.now();
      
      if (timeUntilExpiry < 0) {
        console.log(`[CRON] Token expired for account ${account.accountId}`);
        await prisma.adAccount.update({
          where: { id: account.id },
          data: { status: 'expired' },
        });
      } else if (timeUntilExpiry < warningThreshold) {
        console.log(`[CRON] Token expiring soon for account ${account.accountId}`);
        // TODO: Отправить уведомление пользователю
      }
    }
    
    console.log('[CRON] Token check completed');
  } catch (error) {
    console.error('[CRON] Token check failed:', error);
  }
});

// ============================================
// Запуск сервера
// ============================================

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
  console.log(`  - Stats update: ${config.cron.statsUpdate}`);
  console.log(`  - Rules check: ${config.cron.rulesCheck}`);
  console.log(`  - AI analysis: ${config.cron.aiAnalysis}`);
  console.log(`  - Token check: ${config.cron.tokenCheck}`);
});

// Graceful shutdown
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
