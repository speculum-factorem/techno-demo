# АгроАналитика — Центр-Инвест

Платформа предиктивной аналитики для регионального сельского хозяйства. Прогнозирует урожайность культур и формирует рекомендации по поливу на основе погодных данных и ML-моделей.

## Архитектура

```
Frontend (React + Redux)
      ↓ HTTP /api/*
API Gateway (Spring Cloud Gateway + JWT)
      ↓ маршрутизация
┌─────────────┬──────────────┬───────────────┬──────────────────┬──────────────────┐
│ auth-service│ field-service│weather-service│irrigation-service│notification-svc  │
│   :8081     │    :8082     │    :8083      │      :8084       │      :8085       │
└─────────────┴──────────────┴───────────────┴──────────────────┴──────────────────┘
                                    ↕ Kafka (weather-data, field-events, ...)
                              analytics-service (FastAPI + RandomForest) :8000
                                    ↕
                              PostgreSQL (6 баз данных)
```

## Возможности интеграции

- **Погода (текущее и прогноз):** Open-Meteo Forecast API (`weather-service`).
- **История за период без записей в БД:** подгрузка суточных данных из **Open-Meteo Archive API** (ERA5), если для поля известны координаты.
- **Синхронизация координат:** при старте `weather-service` запрашивает `/api/fields` у `field-service` и регистрирует lat/lng (дополнительно к Kafka `field-events`).
- **Аналитика:** `analytics-service` может подтягивать поле и погоду по HTTP (см. `.env.example`).

## Быстрый старт

### Требования

- Docker 24+
- Docker Compose 2.20+

### Запуск

```bash
# 1. Клонируйте репозиторий
git clone <repo-url>
cd HackOff

# 2. (Опционально) настройте переменные окружения
cp .env.example .env
# Отредактируйте .env при необходимости

# 3. Запустите все сервисы
docker-compose up --build

# Сборка займёт 3–5 минут (компиляция Java + обучение ML-модели)
```

### Доступ к приложению

| Сервис | URL |
|--------|-----|
| **Веб-интерфейс** | http://localhost:3000 |
| **API Gateway** | http://localhost:8080 |
| **Field API (Swagger UI)** | http://localhost:8082/swagger-ui.html |
| **Analytics API (Swagger)** | http://localhost:8000/docs |
| **Kafka UI** | http://localhost:8090 |

**Учётные записи (демо):**

| Пользователь | Пароль | Роль / организация |
|--------------|--------|---------------------|
| `admin` | `admin` | Полный доступ ко всем полям |
| `agronomist` | `agronomist` | Только поля с `organizationId = 1` (из JWT) |

Gateway передаёт в сервисы заголовки `X-User-Id`, `X-User-Role`, `X-Organization-Id`.
Между микросервисами для `GET /api/fields` используется общий секрет **`INTERNAL_API_TOKEN`** (заголовок `X-Internal-Token`), см. `.env.example` и `docker-compose.yml`.

**Telegram (опционально):** в `notification-service` задайте `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — критические и предупреждающие алерты дублируются в чат.

## Разработка (без Docker)

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server на :3000, проксирует /api → localhost:8080
```

### Analytics Service

```bash
cd backend/analytics-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Backend (Spring Boot)

Требуется запущенный PostgreSQL и Kafka. Запускайте через Docker Compose инфраструктуру:

```bash
docker-compose up postgres kafka zookeeper -d
cd backend/auth-service
mvn spring-boot:run
```

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Frontend | TypeScript, React 18, Redux Toolkit, SCSS Modules, Recharts |
| API Gateway | Spring Cloud Gateway, JJWT |
| Микросервисы | Java 21, Spring Boot 3.2, Spring Data JPA, Spring Kafka |
| ML / Analytics | Python 3.12, FastAPI, scikit-learn (RandomForest), pandas |
| Брокер сообщений | Apache Kafka + Zookeeper |
| База данных | PostgreSQL 16 (6 отдельных БД) |
| Погодные данные | Open-Meteo API (бесплатно, без API-ключа) |
| Деплой | Docker Compose, nginx, multi-stage builds |

## Kafka-топики

| Топик | Продюсер | Консьюмеры |
|-------|----------|-----------|
| `weather-data` | weather-service | analytics-service, irrigation-service, notification-service |
| `field-events` | field-service | — |
| `irrigation-recommendations` | irrigation-service | notification-service |
| `forecast-results` | analytics-service | notification-service |

## Структура проекта

```
HackOff/
├── frontend/                  # React приложение
│   └── src/
│       ├── domain/            # Сущности и интерфейсы репозиториев
│       ├── application/       # Redux store, слайсы, thunks
│       ├── infrastructure/    # API-клиенты (Axios)
│       └── presentation/      # Компоненты, страницы, стили
├── backend/
│   ├── api-gateway/           # Spring Cloud Gateway
│   ├── auth-service/          # Аутентификация, JWT
│   ├── field-service/         # Управление полями
│   ├── weather-service/       # Погодные данные (Open-Meteo)
│   ├── analytics-service/     # ML-прогнозирование (Python/FastAPI)
│   ├── irrigation-service/    # Рекомендации по поливу
│   └── notification-service/  # Уведомления и алерты
├── scripts/
│   └── init-db.sql            # Инициализация PostgreSQL баз
├── docker-compose.yml
├── .env                       # Переменные окружения (не коммитить)
└── .env.example               # Шаблон переменных окружения
```
