# Архитектура MVP: Facebook Ad Manager

## 1. Краткое понимание задачи

Личный веб-сервис для управления Facebook рекламой. Инструмент для работы с 1-3 аккаунтами, с возможностями подключения через OAuth, просмотра статистики, автоправил и AI-режима управления. Основной упор на простоту и минимальный бюджет.

---

## 2. Рекомендованный стек

### Frontend
| Технология | Обоснование |
|------------|-------------|
| **React 18 + Vite** | Быстрая сборка, горячая перезагрузка, современный DX |
| **Tailwind CSS** | Утилитарный CSS, минимум кастомного кода |
| **TanStack Query** | Кэширование, синхронизация, обработка ошибок |
| **React Router v6** | Простая клиентская маршрутизация |
| **Recharts** | Простые графики (если потребуются) |

### Backend
| Технология | Обоснование |
|------------|-------------|
| **Node.js 18 LTS** | Стабильная, поддержка ES modules |
| **Express.js** | Минималистичный, гибкий, много middleware |
| **Prisma ORM** | Type-safe, автоматические миграции, поддержка SQLite |
| **SQLite** | Не требует сервера, файловая БД, идеально для MVP |
| **node-cron** | Планировщик задач внутри приложения |
| **jsonwebtoken** | JWT аутентификация |
| **axios** | HTTP клиент для API вызовов |

### Интеграции
| Сервис | Назначение |
|--------|------------|
| **Meta Marketing API** | Чтение/запись рекламных данных |
| **OpenRouter API** | Доступ к LLM моделям |

### Инфраструктура
| Компонент | Рекомендация |
|-----------|--------------|
| **Хостинг** | Railway ($5/мес Hobby план) |
| **База данных** | SQLite (встроена в приложение) |
| **Cron** | Railway Cron Jobs |

---

## 3. Архитектура MVP

### Структура проекта

```
fb-manager/
├── client/                      # React SPA
│   ├── src/
│   │   ├── components/          # UI компоненты
│   │   ├── hooks/               # React хуки
│   │   ├── services/            # API сервисы
│   │   ├── types/               # TypeScript типы
│   │   ├── utils/               # Утилиты
│   │   └── App.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── server/                      # Node.js API
│   ├── src/
│   │   ├── config/              # Конфигурация
│   │   ├── middleware/          # Express middleware
│   │   ├── routes/              # API маршруты
│   │   ├── services/            # Бизнес-логика
│   │   ├── utils/               # Утилиты
│   │   └── index.js             # Точка входа
│   ├── prisma/
│   │   ├── schema.prisma        # Схема БД
│   │   └── seed.js              # Начальные данные
│   ├── package.json
│   └── .env
│
├── docs/                        # Документация
├── package.json                 # Root package.json (workspaces)
└── README.md
```

### Диаграмма компонентов

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │Dashboard│ │Campaigns│ │  Rules  │ │ AI Assistant│   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘   │
│       └───────────┼───────────┼──────────────┘          │
│                   │    TanStack Query                   │
└───────────────────┼─────────────────────────────────────┘
                    │ HTTP/JSON
┌───────────────────┼─────────────────────────────────────┐
│                   │      BACKEND (Express)              │
│  ┌────────────────┴────────────────┐                    │
│  │         API Routes              │                    │
│  └────────────────┬────────────────┘                    │
│  ┌────────────────┼────────────────────────────────┐    │
│  │  Facebook │ Rule Engine │ AI Service │ Scheduler│    │
│  └────────────────┼────────────────────────────────┘    │
│  ┌────────────────┴────────────────┐                    │
│  │         SQLite + Prisma         │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────┴────┐          ┌────┴────┐
    │  Meta   │          │OpenRouter│
    │   API   │          │   API   │
    └─────────┘          └─────────┘
```

### Поток данных

1. **OAuth Flow**: User → Frontend → Backend → Facebook OAuth → Callback → Store Tokens
2. **Статистика**: Scheduler → Facebook API → Backend → SQLite → Frontend Display
3. **Правила**: Scheduler → Rule Engine → SQLite (stats) → Evaluate → Facebook API (action)
4. **AI режим**: User/Frontend → AI Service → OpenRouter API → Recommendation/Action

---

## 4. Модель данных

### Схема Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  adAccounts AdAccount[]
}

model AdAccount {
  id             String   @id @default(cuid())
  userId         String
  accountId      String   @unique
  name           String
  timezone       String   @default("UTC")
  accessToken    String
  refreshToken   String?
  tokenExpiresAt DateTime
  status         String   @default("active")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id])
  campaigns      Campaign[]
  adSets         AdSet[]
  ads            Ad[]
  metrics        MetricSnapshot[]
  rules          Rule[]
  ruleExecutions RuleExecution[]
  aiRecommendations AIRecommendation[]
  aiActions      AIAction[]
  approveData    ApproveData[]
}

model Campaign {
  id           String   @id @default(cuid())
  adAccountId  String
  campaignId   String   @unique
  name         String
  status       String
  objective    String?
  createdTime  DateTime
  updatedTime  DateTime
  createdAt    DateTime @default(now())
  adAccount    AdAccount @relation(fields: [adAccountId], references: [id])
  adSets       AdSet[]
}

model AdSet {
  id          String   @id @default(cuid())
  adAccountId String
  campaignId  String
  adSetId     String   @unique
  name        String
  status      String
  budget      Float?
  bidStrategy String?
  createdTime DateTime
  updatedTime DateTime
  createdAt   DateTime @default(now())
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id])
  campaign    Campaign  @relation(fields: [campaignId], references: [id])
  ads         Ad[]
}

model Ad {
  id          String   @id @default(cuid())
  adAccountId String
  adSetId     String
  adId        String   @unique
  name        String
  status      String
  creativeUrl String?
  createdTime DateTime
  updatedTime DateTime
  createdAt   DateTime @default(now())
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id])
  adSet       AdSet     @relation(fields: [adSetId], references: [id])
}

model MetricSnapshot {
  id           String   @id @default(cuid())
  adAccountId  String
  entityType   String
  entityId     String
  entityName   String
  spend        Float    @default(0)
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  ctr          Float    @default(0)
  cpc          Float    @default(0)
  cpm          Float    @default(0)
  leads        Int      @default(0)
  conversions  Int      @default(0)
  cpl          Float    @default(0)
  cpa          Float    @default(0)
  revenue      Float    @default(0)
  roas         Float    @default(0)
  roi          Float    @default(0)
  approves     Int      @default(0)
  cpas         Float    @default(0)
  date         DateTime
  createdAt    DateTime @default(now())
  adAccount    AdAccount @relation(fields: [adAccountId], references: [id])
  @@index([adAccountId, entityType, entityId])
  @@index([adAccountId, date])
}

model Rule {
  id              String   @id @default(cuid())
  adAccountId     String
  name            String
  description     String?
  entityType      String
  condition       String
  action          String
  actionParams    String?
  threshold       Float?
  cooldownMinutes Int      @default(60)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  adAccount       AdAccount       @relation(fields: [adAccountId], references: [id])
  ruleExecutions  RuleExecution[]
}

model RuleExecution {
  id           String   @id @default(cuid())
  ruleId       String
  adAccountId  String
  entityType   String
  entityId     String
  entityName   String
  conditionMet Boolean
  actionTaken  String?
  result       String?
  details      String?
  executedAt   DateTime @default(now())
  rule         Rule      @relation(fields: [ruleId], references: [id])
  adAccount    AdAccount @relation(fields: [adAccountId], references: [id])
  @@index([ruleId])
  @@index([adAccountId, executedAt])
}

model AIRecommendation {
  id                 String   @id @default(cuid())
  adAccountId        String
  entityType         String
  entityId           String
  entityName         String
  recommendationType String
  details            String
  confidence         Float    @default(0)
  isAccepted         Boolean?
  createdAt          DateTime @default(now())
  adAccount          AdAccount @relation(fields: [adAccountId], references: [id])
  @@index([adAccountId, createdAt])
}

model AIAction {
  id          String   @id @default(cuid())
  adAccountId String
  entityType  String
  entityId    String
  entityName  String
  actionType  String
  parameters  String
  reason      String
  status      String   @default("pending")
  result      String?
  createdAt   DateTime @default(now())
  executedAt  DateTime?
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id])
  @@index([adAccountId, createdAt])
}

model ApproveData {
  id          String   @id @default(cuid())
  adAccountId String
  source      String
  externalId  String?
  amount      Float
  currency    String   @default("USD")
  campaignId  String?
  adSetId     String?
  adId        String?
  approvedAt  DateTime
  createdAt   DateTime @default(now())
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id])
  @@index([adAccountId, approvedAt])
}
```

### Диаграмма связей

```
User (1) ──┬── (N) AdAccount
            │
            ├── Campaign (N)
            │      │
            │      └── AdSet (N)
            │             │
            │             └── Ad (N)
            │
            ├── MetricSnapshot (N)
            ├── Rule (N) ── RuleExecution (N)
            ├── AIRecommendation (N)
            ├── AIAction (N)
            └── ApproveData (N)
```

---

## 5. Логика автоправил

### Структура правила (JSON)

```json
{
  "name": "Выключить при CPL > $10",
  "description": "Отключает объявление, если CPL превышает $10",
  "entityType": "ad",
  "condition": {
    "field": "cpl",
    "operator": "greater_than",
    "value": 10,
    "period": "last_7_days"
  },
  "action": {
    "type": "pause",
    "params": {}
  },
  "cooldownMinutes": 60,
  "isActive": true
}
```

### Доступные условия

| Поле | Операторы | Описание |
|------|-----------|----------|
| `spend` | `greater_than`, `less_than` | Расходы |
| `leads` | `equals`, `greater_than`, `less_than` | Количество лидов |
| `cpl` | `greater_than`, `less_than` | Cost Per Lead |
| `roi` | `greater_than`, `less_than` | ROI |
| `roas` | `greater_than`, `less_than` | ROAS |
| `approves` | `equals`, `greater_than` | Количество аппрувов |
| `ctr` | `greater_than`, `less_than` | Click-Through Rate |
| `time_of_day` | `between`, `equals` | Время суток |
| `day_of_week` | `equals`, `in` | День недели |

### Доступные действия

| Действие | Параметры | Описание |
|----------|-----------|----------|
| `pause` | - | Приостановить сущность |
| `enable` | - | Включить сущность |
| `budget_change` | `amount`, `type (percent/fixed)` | Изменить бюджет |
| `bid_change` | `amount`, `type (percent/fixed)` | Изменить ставку |

### Алгоритм выполнения правил

```
Для каждого активного правила:
  1. Получить текущие метрики сущности
  2. Проверить cooldown:
     - Если время с последнего выполнения < cooldown → пропустить
  3. Оценить условие:
     - Загрузить метрики за указанный период
     - Вычислить значение поля
     - Применить оператор сравнения
  4. Если условие выполнено:
     - Проверить текущее состояние сущности
     - Если действие применимо (не паузить уже пауза):
       - Выполнить действие через Facebook API
       - Записать в RuleExecution
  5. Если условие не выполнено:
     - Записать в RuleExecution (conditionMet=false)
```

### Примеры правил

#### Правило 1: Выключить при высоком CPL
```json
{
  "name": "Выключить при CPL > $15",
  "entityType": "ad",
  "condition": {
    "field": "cpl",
    "operator": "greater_than",
    "value": 15,
    "period": "last_7_days"
  },
  "action": { "type": "pause" },
  "cooldownMinutes": 120
}
```

#### Правило 2: Выключить при отсутствии лидов
```json
{
  "name": "Выключить при spend > $50 без лидов",
  "entityType": "ad",
  "condition": {
    "field": "spend",
    "operator": "greater_than",
    "value": 50,
    "additionalCondition": {
      "field": "leads",
      "operator": "equals",
      "value": 0
    },
    "period": "last_7_days"
  },
  "action": { "type": "pause" },
  "cooldownMinutes": 60
}
```

#### Правило 3: Включить по времени (MSK)
```json
{
  "name": "Включить в 9:00 MSK",
  "entityType": "ad",
  "condition": {
    "field": "time_of_day",
    "operator": "equals",
    "value": "09:00",
    "timezone": "Europe/Moscow"
  },
  "action": { "type": "enable" },
  "cooldownMinutes": 1440
}
```

### Cooldown механизм

- При создании правила: `lastExecutedAt = null`
- При выполнении правила: `lastExecutedAt = now()`
- При проверке: `if (now() - lastExecutedAt < cooldownMinutes) → skip`

### Учет часовых поясов

- Поддержка `account.timezone` и `Europe/Moscow` (MSK+3)
- Конвертация времени для правил по расписанию

---

## 6. Логика AI-режима

### Режимы работы

| Режим | Описание |
|-------|----------|
| **Рекомендации** (default) | AI анализирует и предлагает, пользователь решает |
| **Полное управление** | AI анализирует и выполняет автоматически |

### Входные данные для AI

```json
{
  "accountInfo": { "id", "name", "currency", "timezone" },
  "dateRange": { "start", "end" },
  "metrics": { "overall", "campaigns", "adsets", "ads" },
  "rules": [ ... ],
  "aiActions": [ ... ],
  "approveData": [ ... ]
}
```

### Промпт для AI

```
Ты - AI-ассистент по управлению Facebook рекламой.
Проанализируй данные и дай рекомендации в формате JSON:
{
  "analysis": "Общий анализ",
  "recommendations": [
    {
      "entityType": "ad",
      "entityId": "ad_123",
      "type": "pause|enable|budget_change|bid_change",
      "reason": "Причина",
      "confidence": 0.85,
      "params": { ... }
    }
  ],
  "riskLevel": "low|medium|high",
  "summary": "Резюме"
}
```

### Safeguard-механизмы

#### Лимиты на действия
```json
{
  "maxDailyBudgetChange": 30,
  "maxDailyPauseCount": 10,
  "minROIThreshold": -50,
  "maxSpendMultiplier": 2
}
```

#### Проверки перед действием
- Проверка дневного лимита
- Проверка ROI порога
- Проверка бизнес-часов
- Проверка confidence (> 0.8 для автодействий)

#### Rollback механизм
- Сохранение состояния перед действием
- Возможность восстановления при ошибке

### Обработка рекомендаций

**Режим рекомендаций:**
1. AI генерирует рекомендацию → `AIRecommendation` (status: pending)
2. Пользователь принимает/отклоняет
3. При принятии → выполняется действие

**Режим полного управления:**
1. AI генерирует рекомендацию
2. Проверяется confidence и safeguards
3. Если OK → выполняется автоматически → `AIAction`

---

## 7. Интеграция с Meta

### OAuth 2.0 Flow

```
1. Пользователь нажимает "Подключить Facebook"
2. Frontend → Backend: GET /api/auth/facebook
3. Backend → Facebook: Redirect to OAuth URL
4. Facebook → User: Страница авторизации
5. User → Facebook: Разрешает доступ
6. Facebook → Backend: GET /api/auth/facebook/callback?code=xxx
7. Backend → Facebook: Обмен code на токены
8. Backend: Сохраняет токены в БД (зашифрованы)
9. Backend → Frontend: JWT для сессии
10. Frontend: Redirect на Dashboard
```

### Scopes

- `ads_management` — управление рекламой
- `ads_read` — чтение данных
- `business_management` — управление бизнесом
- `read_insights` — аналитика

### Токены

Facebook использует долгоживущие токены (60 дней). Refresh token не предоставляется.

**Стратегия:**
- Проверять `tokenExpiresAt` перед каждым API вызовом
- Если до истечения < 7 дней → предупреждение
- Если токен истек → повторная авторизация

### API вызовы

```javascript
// Получение кампаний
GET https://graph.facebook.com/v18.0/act_{account_id}/campaigns

// Получение статистики
GET https://graph.facebook.com/v18.0/act_{account_id}/insights

// Пауза объявления
POST https://graph.facebook.com/v18.0/{ad_id}
{ "status": "PAUSED" }
```

### Rate Limits

- **200 запросов в час** на пользователя
- **600 запросов в 10 минут** на приложение

**Стратегия:**
- Кэшировать данные в БД
- Использовать batch requests
- Retry с exponential backoff при 429

---

## 8. Инфраструктура и деплой

### Рекомендация: Railway

| Критерий | Railway | VPS (DigitalOcean) | Vercel |
|----------|---------|-------------------|--------|
| **Стоимость** | $5/мес | $5/мес | $20/мес |
| **Простота** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Cron Jobs** | ✅ | ✅ | ❌ |
| **SQLite** | ✅ | ✅ | ⚠️ |

**Почему Railway:**
- Git push = deploy
- Встроенный планировщик cron
- SQLite работает из коробки
- Бесплатный SSL
- Удобные переменные окружения

### Cron задачи

| Задача | Расписание | Описание |
|--------|------------|----------|
| Обновление статистики | каждые 6 часов | Загрузка метрик из Facebook API |
| Проверка правил | каждые 30 минут | Выполнение автоправил |
| AI анализ | каждые 2 часа | Генерация рекомендаций |
| Проверка токенов | раз в день | Уведомления об истечении |

### Переменные окружения

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secret-key
DATABASE_URL=file:./data/prod.db
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI=https://your-app.railway.app/api/auth/facebook/callback
OPENROUTER_API_KEY=your-openrouter-key
ENCRYPTION_KEY=your-encryption-key
```

---

## 9. Риски и узкие места

### Технические риски

| Риск | Вероятность | Влияние | Mitigation |
|------|-------------|---------|------------|
| Facebook API changes | Среднее | Высокое | Стабильная версия v18.0, отслеживание changelog |
| Token expiry | Высокое | Среднее | Автоматические уведомления, повторная авторизация |
| Rate limits | Среднее | Среднее | Кэширование, batch requests, backoff |
| SQLite scalability | Низкое | Низкое | Для MVP достаточно |
| Scheduler failures | Среднее | Среднее | Логирование, retry, мониторинг |

### Бизнес риски

| Риск | Вероятность | Влияние | Mitigation |
|------|-------------|---------|------------|
| Политики Facebook | Среднее | Высокое | Соблюдение правил платформы |
| AI ошибки | Среднее | Среднее | Safeguard-ы, лимиты, rollback |
| Потеря данных | Низкое | Высокое | Регулярные бэкапы SQLite |

---

## 10. Границы MVP

### Обязательно в первой версии

- [x] OAuth подключение Facebook аккаунтов
- [x] Просмотр кампаний, адсетов, объявлений
- [x] Отображение базовой статистики (spend, leads, CPL, ROI)
- [x] Ручной ввод аппрувов
- [x] Создание и управление автоправилами
- [x] Cooldown механизм для правил
- [x] AI режим рекомендаций
- [x] Информативный дашборд с фильтрами
- [x] Фоновые задачи (обновление статистики, проверка правил)

### Отложить на v2

- [ ] AI режим полного управления
- [ ] Сложные графики и визуализации
- [ ] Мобильная адаптивность
- [ ] Мульти-юзер
- [ ] Интеграция постбеков для автоматических аппрувов
- [ ] Продвинутые отчеты
- [ ] Интеграции с другими рекламными платформами
- [ ] A/B тестирование правил

---

## 11. Пошаговый план реализации

### Этап 1: Базовая архитектура (1-2 недели)

- Настройка монорепо (client + server)
- Создание Express сервера с middleware
- Настройка SQLite + Prisma
- JWT аутентификация
- Базовая структура React приложения

### Этап 2: OAuth и подключение аккаунтов (1 неделя)

- Facebook OAuth flow
- Хранение токенов (зашифрованных)
- API для управления аккаунтами
- UI для подключения аккаунтов

### Этап 3: Синхронизация данных (1-2 недели)

- Загрузка кампаний, адсетов, объявлений
- Получение статистики из Facebook API
- Кэширование в MetricSnapshot
- Cron задача для обновления

### Этап 4: Дашборд и UI (1-2 недели)

- Dashboard с общей статистикой
- Таблицы кампаний/адсетов/объявлений
- Фильтры и сортировка
- Ручной ввод аппрувов

### Этап 5: Автоправила (1-2 недели)

- CRUD для правил
- Движок правил (evaluator + executor)
- Cooldown механизм
- Логирование выполнения
- Cron задача для проверки

### Этап 6: AI-режим (1 неделя)

- Интеграция с OpenRouter
- Генерация рекомендаций
- UI для просмотра рекомендаций
- Safeguard-ы

### Этап 7: Деплой и тестирование (1 неделя)

- Деплой на Railway
- Настройка cron задач
- Тестирование всех функций
- Документация

### Итого: ~8-10 недель на MVP

---

## Заключение

Этот план обеспечивает:
- **Простоту**: минимум зависимостей, SQLite, монолитный бэкенд
- **Стоимость**: ~$5/мес на Railway
- **Скорость**: MVP за 2-2.5 месяца
- **Масштабируемость**: возможность миграции на PostgreSQL, разделения сервисов

Ключевой принцип: **начать просто, масштабировать по необходимости**.
