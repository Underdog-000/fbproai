# Facebook Ad Manager

Личный инструмент для управления Facebook рекламой. MVP для работы с 1-3 аккаунтами.

## Возможности

- ✅ **OAuth подключение** Facebook рекламных аккаунтов
- ✅ **Просмотр статистики** по аккаунтам / кампаниям / адсетам / объявлениям
- ✅ **Ручной ввод аппрувов** для расчета ROI
- ✅ **Автоматические правила** с cooldown-механизмом
- ✅ **AI-режим** рекомендаций через OpenRouter
- ✅ **Дашборд** с ключевыми метриками
- ✅ **Фоновые задачи** для синхронизации данных

## Стек технологий

### Frontend
- React 18 + Vite
- Tailwind CSS
- TanStack Query (React Query)
- React Router v6
- Lucide React (иконки)

### Backend
- Node.js 18 + Express
- Prisma ORM + SQLite
- JWT аутентификация
- node-cron (планировщик)
- Axios (HTTP клиент)

### Интеграции
- Meta Marketing API v18.0
- OpenRouter API (AI)

### Инфраструктура
- Railway ($5/мес)
- SQLite (файловая БД)

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd fb-manager
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте `server/.env.example` в `server/.env` и заполните:

```bash
cp server/.env.example server/.env
```

Обязательные переменные:
```env
JWT_SECRET=your-super-secret-jwt-key
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
OPENROUTER_API_KEY=your-openrouter-key
ENCRYPTION_KEY=your-32-char-encryption-key
```

### 4. Настройка Facebook App

1. Перейдите на [developers.facebook.com](https://developers.facebook.com/)
2. Создайте приложение типа "Business"
3. Добавьте продукт "Facebook Login"
4. Настройте Valid OAuth Redirect URIs: `http://localhost:3000/api/auth/facebook/callback`
5. Добавьте продукт "Marketing API"
6. Запросите разрешения: `ads_management`, `ads_read`, `business_management`

### 5. Настройка OpenRouter

1. Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai/)
2. Получите API ключ
3. Пополните баланс (минимум $5)

### 6. Инициализация базы данных

```bash
cd server
npm run db:push
```

### 7. Запуск приложения

```bash
# Development режим (запуск frontend и backend)
npm run dev

# Или отдельно:
# Backend: cd server && npm run dev
# Frontend: cd client && npm run dev
```

Приложение будет доступно:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Структура проекта

```
fb-manager/
├── client/                      # React SPA
│   ├── src/
│   │   ├── components/          # UI компоненты
│   │   ├── pages/               # Страницы
│   │   ├── App.tsx              # Главный компонент
│   │   └── main.tsx             # Точка входа
│   └── package.json
│
├── server/                      # Node.js API
│   ├── src/
│   │   ├── config/              # Конфигурация
│   │   ├── middleware/          # Express middleware
│   │   ├── routes/              # API маршруты
│   │   ├── services/            # Бизнес-логика
│   │   └── index.js             # Точка входа
│   ├── prisma/
│   │   └── schema.prisma        # Схема БД
│   └── package.json
│
├── package.json                 # Root package.json
├── Procfile                     # Railway конфигурация
└── README.md
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/facebook` - Facebook OAuth URL
- `GET /api/auth/facebook/callback` - Facebook OAuth callback

### Аккаунты
- `GET /api/accounts` - Список аккаунтов
- `GET /api/accounts/:accountId` - Детали аккаунта
- `POST /api/accounts/:accountId/sync` - Синхронизация данных
- `GET /api/accounts/:accountId/stats` - Статистика
- `DELETE /api/accounts/:accountId` - Удаление аккаунта

## Автоматические задачи (Cron)

- **Каждые 6 часов**: Обновление статистики
- **Каждые 30 минут**: Проверка правил автоматизации
- **Каждые 2 часа**: AI анализ и рекомендации
- **Раз в день**: Проверка токенов

## Правила автоматизации

Примеры правил:
- Выключить при CPL > $10
- Выключить при spend > $50 без лидов
- Включить в 9:00 MSK

Поддерживаемые условия:
- `spend` - расходы
- `leads` - количество лидов
- `cpl` - стоимость лида
- `roi` / `roas` - рентабельность
- `ctr` - кликабельность
- `time_of_day` - время суток

Действия:
- `pause` - приостановить
- `enable` - включить
- `budget_change` - изменить бюджет
- `bid_change` - изменить ставку

## Деплой на Railway

1. Создайте аккаунт на [railway.app](https://railway.app/)
2. Подключите GitHub репозиторий
3. Настройте переменные окружения в Railway dashboard
4. Deploy будет автоматическим при push в main

### Переменные окружения для production:
```env
NODE_ENV=production
JWT_SECRET=your-production-secret
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
OPENROUTER_API_KEY=your-key
ENCRYPTION_KEY=your-key
```

## Безопасность

- JWT токены для аутентификации
- AES-256-GCM шифрование токенов Facebook
- HTTPS в production
- Валидация входных данных
- Rate limiting (планируется)

## Ограничения MVP

- Максимум 10 аккаунтов на пользователя
- Максимум 50 правил на аккаунт
- AI режим только рекомендаций (полное управление в v2)
- Нет мобильной адаптивности (планируется в v2)

## Планы на v2

- [ ] AI режим полного управления
- [ ] Мобильная адаптивность
- [ ] Мульти-юзер
- [ ] Интеграция постбеков для автоматических аппрувов
- [ ] Продвинутые отчеты и графики
- [ ] A/B тестирование правил
- [ ] Интеграции с другими рекламными платформами

## Лицензия

MIT

## Поддержка

По вопросам обращайтесь: [email protected]