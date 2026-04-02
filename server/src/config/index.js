// Конфигурация приложения
// Все настройки загружаются из переменных окружения

import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Сервер
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // База данных
  databaseUrl: process.env.DATABASE_URL || 'file:./data/dev.db',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '7d',
  
  // Facebook OAuth
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/auth/facebook/callback',
    apiVersion: 'v18.0',
    scopes: ['ads_management', 'ads_read', 'business_management', 'read_insights'],
  },
  
  // OpenRouter (для AI)
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3-haiku',
  },
  
  // Шифрование
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-long',
  
  // Cron расписания
  cron: {
  statsUpdate: '0 */6 * * *',        // Каждые 6 часов
  rulesCheck: '*/30 * * * *',        // Каждые 30 минут
  aiAnalysis: '0 */2 * * *',         // Каждые 2 часа
  tokenCheck: '0 9 * * *',           // Раз в день в 9:00
},
  
  // Лимиты
  limits: {
    maxAccountsPerUser: 10,
    maxRulesPerAccount: 50,
    maxDailyBudgetChange: 30,
    maxDailyPauseCount: 10,
    minConfidenceForAutoAction: 0.8,
  },
  
  // Часовые пояса
  timezones: {
    msk: 'Europe/Moscow',
    default: 'UTC',
  },
};

// Валидация обязательных переменных в production
if (config.nodeEnv === 'production') {
  const required = ['JWT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export default config;
