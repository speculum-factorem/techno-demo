# АгроАналитика

Веб-платформа для учёта полей, погоды, прогноза урожайности (ML), рекомендаций по поливу, спутниковой аналитики, отчётов и уведомлений. Архитектура — **React SPA** → **API Gateway (JWT)** → **микросервисы на Spring Boot** и **Python FastAPI (analytics)**, обмен событиями через **Kafka**, данные в **PostgreSQL** (отдельная БД на сервис).

> **Полный технический справочник** (все HTTP-маршруты, JWT, CORS, тома Docker, маппинг `/api/analytics` → FastAPI, чек-лист prod):  
> **[docs/COMPLETE_REFERENCE.md](./docs/COMPLETE_REFERENCE.md)**

---

## Содержание

1. [Возможности](#возможности)
2. [Архитектура](#архитектура)
3. [Потоки данных (сквозные сценарии)](#потоки-данных-сквозные-сценарии)
4. [API Gateway: маршрутизация](#api-gateway-маршрутизация)
5. [Аутентификация и сессия](#аутентификация-и-сессия)
6. [Сервисы и порты](#сервисы-и-порты)
7. [Kafka](#kafka)
8. [Безопасность и заголовки](#безопасность-и-заголовки)
9. [Требования](#требования)
10. [Быстрый старт (Docker Compose)](#быстрый-старт-docker-compose)
11. [Production-деплой](#production-деплой)
12. [Переменные окружения (развёрнуто)](#переменные-окружения-развёрнуто)
13. [Локальная разработка](#локальная-разработка)
14. [ML и аналитика](#ml-и-аналитика)
15. [Мониторинг](#мониторинг)
16. [Операции: логи, обновление, бэкап](#операции-логи-обновление-бэкап)
17. [Структура репозитория](#структура-репозитория)
18. [Версии стека](#версии-стека)
19. [CI](#ci)
20. [Устранение неполадок](#устранение-неполадок)
21. [Документация (все файлы)](#документация-все-файлы)

---

## Возможности

| Область | Описание |
|--------|----------|
| **Поля** | Картотека полей: культура, площадь, координаты, почва, статус; карты (Leaflet). |
| **Погода** | Текущие условия и прогноз через **Open-Meteo**; при необходимости — история из Archive API. |
| **Прогноз урожайности** | ML-модель в `analytics-service` (Random Forest), факторы влияния, интервалы и уверенность. |
| **Полив** | Рекомендации с приоритетом (влажность почвы, осадки, прогноз); задачи в `irrigation-service`. |
| **Алерты** | Лента событий из Kafka-потоков; опционально **Telegram** и **e-mail** (`notification-service`). |
| **Спутник** | Слои по **STAC / Sentinel-2** (Microsoft Planetary Computer), см. `analytics-service`. |
| **Сценарии «что если»** | Оценка урожайности при заданных погодных вводах. |
| **Планировщик работ** | Задачи по полям (`/ops/work-tasks` в analytics). |
| **Паспорт поля** | Сводка и записи паспорта, сезоны (`field-service`). |
| **Точность прогноза** | Метрики модели (демо на синтетике, см. документацию ML). |
| **Техника** | Оборудование и телеметрия (демо/API в analytics). |
| **Отчёты** | Генерация, история, расписание; файлы в томе `analytics_reports`. |
| **Аудит** | Журнал действий (`/ops/audit-log`). |
| **Правила уведомлений** | CRUD правил (`/ops/notification-rules`). |
| **RBAC** | Роли, инвайты, админ-API (`/api/auth/admin/*`). |
| **Интеграции** | Коннекторы, конфигурация (`/integrations/*` в analytics). |

**Публичные страницы:** лендинг (`/`), «О сервисе», «О приложении», документация (`/docs`), политика конфиденциальности. **Аутентификация:** регистрация (подтверждение e-mail при настроенной почте), вход (при необходимости — код), восстановление пароля, refresh-токены.

**Маршруты SPA после входа** (префикс `/app`): дашборд (`index`), `fields`, `forecast`, `irrigation`, `weather`, `alerts`, `model-metrics`, `field-insights`, `scenario-planner`, `work-planner`, `satellite`, `equipment`, `audit`, `notification-rules`, `reports`, `rbac`, `integrations`.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React 18, Redux Toolkit, Vite, SCSS Modules)         │
│  Nginx в Docker: SPA + proxy /api → api-gateway                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP(S), Cookie-less API: Bearer JWT
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Gateway (Spring Cloud Gateway) :8080                        │
│  Глобальный JWT-фильтр, CORS, маршруты /api/auth|fields|weather…  │
└─────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
      │          │          │          │          │
      ▼          ▼          ▼          ▼          ▼
  auth      field      weather   irrigation  notification
  :8081     :8082      :8083      :8084        :8085
      │          │          │          │          │
      │          └────┬─────┴────┬─────┴────┬─────┘
      │               │          │          │
      │               ▼          ▼          ▼
      │         Apache Kafka (KRaft, Confluent cp-kafka 7.6)
      │               │
      │               ▼
      │         analytics-service (FastAPI, Uvicorn) :8000
      │         StripPrefix на маршруте /api/analytics/**
      │
      └──────────────────────────────────────────┐
                                                 ▼
                                    PostgreSQL 16 — БД: authdb, fielddb,
                                    weatherdb, irrigationdb, notificationdb, analyticsdb
```

**Внешние системы**

| Система | Использование |
|---------|----------------|
| **Open-Meteo** | Прогноз и архив погоды без API-ключа в типовом режиме |
| **Microsoft Planetary Computer (STAC)** | Спутник Sentinel-2 L2A (COG); исходящий HTTPS из `analytics-service` |
| **SMTP** | Регистрация, верификация, отчёты по расписанию (если задано) |
| **Telegram Bot API** | Дублирование критичных/предупреждающих алертов |

---

## Потоки данных (сквозные сценарии)

### Погода → аналитика → уведомления

1. **field-service** сохраняет поле с координатами → при событии может публиковаться **Kafka** `field-events`.
2. **weather-service** подтягивает поля (HTTP + Kafka), опрашивает **Open-Meteo**, пишет снапшоты в **weatherdb** и публикует **Kafka** `weather-data`.
3. **analytics-service** потребляет `weather-data`, может пересчитывать прогноз урожайности и публиковать **`forecast-results`**.
4. **notification-service** потребляет `forecast-results`, `irrigation-recommendations`, при необходимости шлёт **Telegram**/почту и пишет алерты в **notificationdb** (UI читает `/api/alerts`).

### Прогноз по запросу из UI

1. Браузер: `POST /api/analytics/forecast/yield` с JWT.
2. Gateway снимает префикс `/api/analytics` → FastAPI получает `POST /forecast/yield`.
3. Сервис тянет контекст поля из **field-service** и погоду из **Open-Meteo** (или кэш), возвращает прогноз + explainability.

Подробные пути — в [COMPLETE_REFERENCE.md](./docs/COMPLETE_REFERENCE.md).

---

## API Gateway: маршрутизация

Конфигурация: `backend/api-gateway/src/main/resources/application.yml` (в Docker активируется профиль `docker` для полного блока CORS: `application-docker.yml`).

| Префикс запроса клиента | Сервис | Порт в сети compose | Особенности |
|-------------------------|--------|----------------------|-------------|
| `/api/auth/**` | auth-service | 8081 | Публичные подпути см. ниже |
| `/api/fields/**` | field-service | 8082 | Только JWT |
| `/api/weather/**` | weather-service | 8083 | Только JWT |
| `/api/analytics/**` | analytics-service | 8000 | **StripPrefix=2** → путь без `/api/analytics` |
| `/api/irrigation/**` | irrigation-service | 8084 | Только JWT |
| `/api/alerts/**` | notification-service | 8085 | Только JWT |

**Пример StripPrefix:** запрос `GET /api/analytics/model/metrics` на стороне FastAPI = `GET /model/metrics`.

---

## Аутентификация и сессия

Реализация: `JwtAuthFilter` в **api-gateway**.

- **Публично** (без `Authorization`): большинство `/api/auth/*`, **кроме** `/api/auth/me`, `/api/auth/change-password`, всего `/api/auth/admin/**`.
- **Защищено:** все `/api/fields`, `/api/weather`, `/api/analytics`, `/api/irrigation`, `/api/alerts`, а также `me`, `change-password`, `admin/*`.

После проверки JWT gateway добавляет заголовки **`X-User-Id`**, **`X-User-Role`**, **`X-Organization-Id`** для downstream.

**Фронтенд**

- `localStorage`: ключи `tokens` (`accessToken`, `refreshToken`, `expiresIn`) и `user`.
- Axios: `frontend/src/infrastructure/api/ApiClient.ts` — ко всем непубличным запросам добавляется `Bearer`, при 401 выполняется **`POST /api/auth/refresh`**, при провале — очистка и редирект на `/auth/login`.

**Сервис-сервис** к защищённым API полей: заголовок **`X-Internal-Token`**, значение = `INTERNAL_API_TOKEN`.

---

## Сервисы и порты

Порта ниже — **режим разработки** (`docker-compose.yml`). В **production** (`docker-compose.prod.yml`) наружу обычно только **80** (nginx фронта).

| Компонент | Публикация (dev) | Назначение |
|-----------|------------------|------------|
| **frontend** | **80**, **3000** → 80 | Статика + `location /api/` → gateway |
| **api-gateway** | 8080 | Единая точка API |
| **auth-service** | только внутри сети (8081) | JWT, пользователи, bootstrap |
| **field-service** | **8082** (+ Swagger UI) | Поля, паспорт |
| **weather-service** | 8083 | Погода, Kafka producer |
| **irrigation-service** | 8084 | Задачи полива |
| **notification-service** | 8085 | Алерты |
| **analytics-service** | **8000** (+ `/docs`) | ML, отчёты, спутник, ops API |
| **postgres** | 5432 | Все БД |
| **kafka** | 9092, 29092 | KRaft single-node |
| **kafka-ui** | 8090 | Обзор топиков |
| **prometheus** | 9090 | Скрапинг `/actuator/prometheus` JVM-сервисов |
| **grafana** | 3001 | Дашборды (admin пароль см. compose / `GRAFANA_ADMIN_PASSWORD`) |

**Учётные записи по умолчанию** создаются **auth-service** из `.env`: `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_AGRONOMIST_PASSWORD` для пользователей `admin` и `agronomist` (логины фиксированы в коде сидов; пароли — из env).

---

## Kafka

| Топик | Продюсер | Потребители (по коду проекта) |
|-------|----------|-------------------------------|
| `weather-data` | weather-service | analytics-service, irrigation-service, notification-service |
| `field-events` | field-service | (расширяемо другими консьюмерами) |
| `irrigation-recommendations` | irrigation-service | notification-service |
| `forecast-results` | analytics-service | notification-service |

`KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` — топики появятся при первой публикации.

---

## Безопасность и заголовки

| Тема | Рекомендация |
|------|----------------|
| **JWT_SECRET** | Длинная случайная строка (байты для HMAC), одинаковая в gateway и auth-service |
| **INTERNAL_API_TOKEN** | Секрет только для бэкендов, не для браузера |
| **CORS** | Явный список `APP_CORS_ALLOWED_ORIGINS` для production URL фронта |
| **Postgres** | Пароль роли задаётся при **инициализации тома**; смена в `.env` без пересоздания тома → ошибки аутентификации |
| **HTTPS** | На production терминируйте TLS на reverse-proxy перед контейнером фронта |

---

## Требования

| Компонент | Версия / примечание |
|-----------|---------------------|
| Docker | 24+ |
| Docker Compose | V2 (`docker compose`) |
| RAM (полный стек) | от **8 GB** комфортно |
| Node (локально фронт) | 20 (как в Dockerfile и CI) |
| Java | 17 или 21 — см. отдельный сервис в CI |
| Python (analytics локально) | 3.12+ |

---

## Быстрый старт (Docker Compose)

```bash
git clone <repository-url>
cd techno-demo

cp .env.example .env
# Обязательно задать: POSTGRES_USER, POSTGRES_PASSWORD, JWT_SECRET, INTERNAL_API_TOKEN,
# BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_AGRONOMIST_PASSWORD, APP_CORS_ALLOWED_ORIGINS

docker compose up --build
```

Первая сборка: компиляция нескольких **Maven**-сервисов, образ **analytics** с зависимостями Python; при старте **analytics-service** обучает ML-модель (в логах появится сообщение об обучении).

**Полезные URL (dev)**

| Назначение | URL |
|------------|-----|
| Приложение | http://localhost:3000 или http://localhost:80 |
| Gateway | http://localhost:8080 |
| Swagger полей | http://localhost:8082/swagger-ui.html |
| OpenAPI analytics | http://localhost:8000/docs |
| Kafka UI | http://localhost:8090 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

---

## Production-деплой

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- Внешний мир видит в основном **порт 80** (фронт).
- Задайте `APP_CORS_ALLOWED_ORIGINS` и `FRONTEND_URL` под **реальный** URL/IP.
- Пошаговая инструкция (Ubuntu, firewall, том Postgres, обновление, бэкап): **[DEPLOY_SERVER.md](./DEPLOY_SERVER.md)**.

---

## Переменные окружения (развёрнуто)

Ниже — справочник по переменным из **[.env.example](./.env.example)**. В `docker-compose.yml` часть подставляется в контейнеры явно.

| Переменная | Где используется | Комментарий |
|------------|------------------|-------------|
| `POSTGRES_USER` | postgres + все JDBC/URL | Не менять произвольно после создания тома |
| `POSTGRES_PASSWORD` | то же | То же; см. предупреждение в `.env.example` |
| `JWT_SECRET` | gateway, auth | Общий секрет подписи JWT |
| `INTERNAL_API_TOKEN` | field, weather, analytics, irrigation, notification | Межсервисная авторизация |
| `APP_CORS_ALLOWED_ORIGINS` | api-gateway | Список Origin через запятую |
| `FRONTEND_URL` | auth, notification | Ссылки в письмах и редиректах |
| `BOOTSTRAP_ADMIN_PASSWORD` | auth-service | Пароль пользователя `admin` при сидировании |
| `BOOTSTRAP_AGRONOMIST_PASSWORD` | auth-service | Пароль `agronomist` |
| `BOOTSTRAP_INVITE_CODE` | auth-service | Код приглашения для регистрации (дефолт в example) |
| `REGISTER_RATE_LIMIT_*` | auth-service | Лимит частоты регистрации |
| `VERIFICATION_TTL_MINUTES` | auth-service | Срок жизни токена верификации e-mail |
| `MAIL_*` | auth, notification, analytics | SMTP для писем и отчётов |
| `MAIL_FROM` | analytics | Отправитель файлов отчётов |
| `REPORTS_STORAGE_DIR` | analytics | В Docker обычно `/data/reports` (том) |
| `TELEGRAM_*` | notification (+ упоминание в example) | Внешние алерты |
| `NOTIFICATION_EMAIL_ENABLED`, `NOTIFICATION_EMAIL_TO` | notification-service | Дублирование алертов на почту |
| `FIELD_SERVICE_URL`, `OPEN_METEO_BASE_URL`, … | analytics (env в compose) | URL зависимостей внутри Docker |
| `GRAFANA_ADMIN_PASSWORD` | grafana (опционально) | Пароль admin Grafana |

Полные комментарии и сценарий сброса тома БД — в **`.env.example`**.

---

## Локальная разработка

### Frontend

```bash
cd frontend
npm ci
npm run dev
# http://localhost:5173 — прокси /api → localhost:8080
```

Опционально: файл **`frontend/.env`** с `VITE_API_URL=http://localhost:8080/api` (редко нужно; по умолчанию относительный `/api`).

В **gateway** для dev добавьте Origin **`http://localhost:5173`** в `APP_CORS_ALLOWED_ORIGINS`.

```bash
npm run build && npm run preview
```

### Analytics (Python)

```bash
cd backend/analytics-service
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Нужны доступные **PostgreSQL** и **Kafka** (или поднять `docker compose up -d postgres kafka` и выставить переменные как в compose).

### Spring Boot

```bash
docker compose up -d postgres kafka
cd backend/<service>
mvn spring-boot:run
```

Порты и `application.yml` / профиль `docker` смотрите в каждом модуле.

---

## ML и аналитика

| Ресурс | Содержание |
|--------|------------|
| [docs/mlModel.md](./docs/mlModel.md) | RandomForest, фичи, confidence, Kafka, ограничения PoC |
| [docs/ML_TESTING.md](./docs/ML_TESTING.md) | Запуск проверок, интерпретация метрик |
| `backend/analytics-service/scripts/ml_evaluation_suite.py` | CLI: `--all`, `--accuracy`, `--scenarios`, `--irrigation`, `--latency` |

Обучение по умолчанию на **синтетике** — метрики в UI не гарантируют качество на реальных хозяйствах без своего датасета и переобучения.

---

## Мониторинг

- **Prometheus** (`monitoring/prometheus.yml`): jobs для gateway, auth, field, weather, irrigation, notification (`/actuator/prometheus`). **analytics-service** в конфиге по умолчанию может отсутствовать — добавьте при необходимости.
- **Grafana**: provisioning в `monitoring/grafana/`.
- В **prod** порты 9090/3001 часто отключены в override — открывайте осознанно (VPN/firewall).

---

## Операции: логи, обновление, бэкап

```bash
# Статус
docker compose ps

# Логи сервиса
docker compose logs -f --tail=200 api-gateway
docker compose logs -f analytics-service

# Пересборка после git pull
docker compose up -d --build

# Минимальный бэкап тома Postgres (пример)
docker run --rm -v techno-demo_postgres_data:/volume -v $(pwd):/backup alpine \
  tar czf /backup/postgres_data_$(date +%F).tar.gz -C /volume .
```

Имя тома может иметь префикс имени проекта Compose — проверка: `docker volume ls | grep postgres`.

---

## Структура репозитория

```
techno-demo/
├── frontend/
│   ├── src/
│   │   ├── domain/
│   │   ├── application/       # Redux
│   │   ├── infrastructure/    # Axios, API-модули
│   │   └── presentation/      # Страницы, layout, SCSS modules
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts         # proxy /api, алиасы @domain, @application, …
├── backend/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── field-service/
│   ├── weather-service/
│   ├── irrigation-service/
│   ├── notification-service/
│   └── analytics-service/     # main.py, report_exports, satellite_stac, …
├── scripts/
│   └── init-db.sql
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/
├── docs/
│   ├── COMPLETE_REFERENCE.md  # полный справочник API и операций
│   ├── mlModel.md
│   └── ML_TESTING.md
├── .github/workflows/ci.yml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── DEPLOY_SERVER.md
└── README.md
```

---

## Версии стека

| Технология | Версия (ориентир по репозиторию) |
|------------|----------------------------------|
| React | 18 |
| Vite | 6 |
| TypeScript | 5.6 |
| Spring Boot | 3.2 (gateway и большинство сервисов) |
| Java | 17 / 21 (см. CI по job) |
| PostgreSQL (образ) | 16-alpine |
| Kafka | Confluent 7.6.0 (KRaft) |
| Python (analytics) | 3.12 (Dockerfile) |

---

## CI

Файл **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** (ветки `main` / `master`):

- **frontend:** `npm ci`, `tsc --noEmit`, `npm run build`
- **Java:** `mvn -B verify` для api-gateway, auth, field, weather, irrigation, notification

**analytics-service** в pipeline не включён — имеет смысл добавить отдельный job (установка зависимостей, `ruff`/`pytest` при наличии).

---

## Устранение неполадок

### Postgres: `password authentication failed`

Пароль роли в кластере задаётся при **первом** создании тома. Решения: вернуть старые `POSTGRES_*` в `.env` или удалить том `postgres_data` и поднять стек заново (**все данные удалятся**). Подробно в `.env.example`.

### CORS / 403 на preflight

Проверьте точное совпадение **Origin** (схема, хост, порт) с `APP_CORS_ALLOWED_ORIGINS`. Для Docker-фронта и Vite нужны оба origin, если используете оба.

### Долгий `unhealthy`

Kafka: до **3 минут** start_period. JVM-сервисы: смотрите логи и увеличьте ресурсы хоста.

### Пустой прогноз / ошибки analytics

Проверьте доступность **field-service** и **Open-Meteo** из контейнера, логи `analytics-service`, наличие координат у поля.

### Nginx и Origin

В `frontend/nginx.conf` намеренно **не** затирается заголовок `Origin` при прокси на gateway — иначе Spring CORS может отклонить запрос.

---

## Документация (все файлы)

| Файл | Назначение |
|------|------------|
| **[docs/COMPLETE_REFERENCE.md](./docs/COMPLETE_REFERENCE.md)** | **Полный** справочник: все эндпоинты, JWT, StripPrefix, БД, тома, Kafka, фронт, чек-лист prod |
| [.env.example](./.env.example) | Переменные окружения с длинными комментариями |
| [DEPLOY_SERVER.md](./DEPLOY_SERVER.md) | Деплой на VPS, обновление, бэкап |
| [docs/mlModel.md](./docs/mlModel.md) | ML-модель урожайности и выводы по зрелости |
| [docs/ML_TESTING.md](./docs/ML_TESTING.md) | Тестирование ML и API метрик |
| Витрина **/docs** в React | Пользовательская документация в интерфейсе лендинга |
