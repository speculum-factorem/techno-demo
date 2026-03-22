# АгроАналитика — полный справочник

Документ дополняет [README.md](../README.md): здесь детализированы **HTTP API**, **маршрутизация gateway**, **JWT**, **хранилища**, **интеграция фронтенда** и **операции**.

---

## 1. Точки входа и URL

| Среда | Базовый URL UI | Базовый URL API (для браузера) |
|--------|----------------|--------------------------------|
| Docker (dev) | `http://localhost:3000` или `http://localhost:80` | Тот же хост, путь `/api/...` (nginx → gateway) |
| Vite dev | `http://localhost:5173` | `/api/...` проксируется на `http://localhost:8080` |
| Прямой gateway (отладка) | — | `http://localhost:8080/api/...` |

Переменная **`VITE_API_URL`** (опционально): если задана при сборке фронта, Axios использует её как `baseURL` вместо относительного `/api`.

---

## 2. API Gateway: маршруты и префиксы

Файл: `backend/api-gateway/src/main/resources/application.yml`.

| Predicate (путь с клиента) | Upstream | Примечание |
|----------------------------|----------|------------|
| `/api/auth/**` | `http://auth-service:8081` | Путь без изменений |
| `/api/fields/**` | `http://field-service:8082` | Без изменений |
| `/api/weather/**` | `http://weather-service:8083` | Без изменений |
| `/api/analytics/**` | `http://analytics-service:8000` | **StripPrefix=2** — с пути снимаются два первых сегмента `api` и `analytics` |
| `/api/irrigation/**` | `http://irrigation-service:8084` | Без изменений |
| `/api/alerts/**` | `http://notification-service:8085` | Без изменений |

### 2.1. Маппинг analytics (важно)

Запрос клиента:

`GET /api/analytics/model/metrics`

После `StripPrefix=2` в FastAPI уходит:

`GET /model/metrics`

То есть **внутренний путь** = `/api/analytics` заменён на корень сервиса. Ниже в таблицах для analytics указаны **оба** варианта: **клиентский** (через gateway) и **внутренний** (в `main.py`).

---

## 3. Аутентификация и JWT

### 3.1. Фильтр gateway

Класс: `backend/api-gateway/.../JwtAuthFilter.java`.

- Для всех путей **кроме** перечисленных ниже требуется заголовок  
  `Authorization: Bearer <accessToken>`.

**Публичные пути** (JWT не проверяется):

- Всё под `/api/auth/`, **кроме**:
  - `/api/auth/admin/**` (всегда защищено),
  - `/api/auth/me`,
  - `/api/auth/change-password`.

Итого без токена доступны, например: `login`, `register`, `refresh`, `forgot-password`, `reset-password`, `verify-email`, `verify-email-code` и вложенные `resend` там, где есть.

**Защищённые пути auth:** `/api/auth/me`, `/api/auth/change-password`, `/api/auth/admin/**`.

**Все остальные `/api/*`** (fields, weather, analytics, irrigation, alerts) — **только с валидным JWT**.

### 3.2. Заголовки к downstream

После успешной проверки JWT gateway добавляет:

| Заголовок | Содержимое |
|-----------|------------|
| `X-User-Id` | `sub` из JWT |
| `X-User-Role` | claim `role` |
| `X-Organization-Id` | claim `organizationId` (число приводится к строке) |

Сервисы используют их для фильтрации данных по организации и роли.

### 3.3. Сервис-сервис: internal token

Для вызовов **field-service** с других бэкендов (например, weather → fields) используется заголовок:

`X-Internal-Token: <INTERNAL_API_TOKEN>`

Значение задаётся в `.env` и в `docker-compose.yml` для соответствующих сервисов.

### 3.4. CORS

Настраивается в **api-gateway** (`globalcors`). Обязательно задать **`APP_CORS_ALLOWED_ORIGINS`** с точными Origin фронта (включая схему и порт), иначе браузерный preflight может завершиться **403**.

В профиле `docker` дополнительно разрешены `allowedOriginPatterns` вида `http://*`, `https://*` — для гибкости на стендах; на проде опирайтесь на явный список origin.

### 3.5. Хранение токенов во фронтенде

- **`localStorage`** ключ `tokens`: JSON `{ accessToken, refreshToken, expiresIn }`.
- **`localStorage`** ключ `user`: профиль пользователя для UI.

Файлы: `frontend/src/infrastructure/api/ApiClient.ts`, `frontend/src/application/store/slices/authSlice.ts`.

При **401** на защищённых запросах выполняется попытка **`POST /api/auth/refresh`** с `refreshToken`; при неудаче — очистка storage и редирект на `/auth/login`.

Публичные запросы (регистрация, логин и т.д.) **не** получают автоматический `Authorization`, см. `isPublicAuthRequest` в `ApiClient.ts`.

---

## 4. Справочник HTTP API по сервисам

Ниже пути **как с клиента** (через gateway), методы и краткое назначение.

### 4.1. auth-service — `/api/auth`

| Метод | Путь | JWT | Описание |
|-------|------|-----|----------|
| POST | `/api/auth/login` | Нет | Вход |
| POST | `/api/auth/login/verify-code` | Нет | Подтверждение кода входа (если включено) |
| POST | `/api/auth/login/resend-code` | Нет | Повтор кода |
| POST | `/api/auth/register` | Нет | Регистрация |
| GET | `/api/auth/verify-email` | Нет | Верификация по ссылке (query) |
| POST | `/api/auth/verify-email-code` | Нет | Код с почты |
| POST | `/api/auth/verify-email-code/resend` | Нет | Повтор письма |
| POST | `/api/auth/logout` | Нет* | Выход (токен может передаваться по политике клиента) |
| POST | `/api/auth/refresh` | Нет | Обновление пары токенов |
| GET | `/api/auth/me` | **Да** | Текущий пользователь |
| POST | `/api/auth/forgot-password` | Нет | Запрос сброса |
| POST | `/api/auth/reset-password` | Нет | Новый пароль по токену |
| POST | `/api/auth/change-password` | **Да** | Смена пароля |
| GET | `/api/auth/admin/users` | **Да** (admin) | Список пользователей |
| PATCH | `/api/auth/admin/users/{id}/role` | **Да** (admin) | Роль |
| PATCH | `/api/auth/admin/users/{id}/active` | **Да** (admin) | Активность |
| POST | `/api/auth/admin/invites` | **Да** (admin) | Создать invite |
| GET | `/api/auth/admin/invites` | **Да** (admin) | Список invite |
| DELETE | `/api/auth/admin/invites/{code}` | **Да** (admin) | Удалить invite |

\*Точные требования к телу запроса смотрите в контроллерах и OpenAPI при наличии.

### 4.2. field-service — `/api/fields`

Базовый префикс контроллера: `/api/fields`. Все методы — с **JWT** через gateway.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/fields` | Список полей (с учётом org/роли) |
| GET | `/api/fields/{id}` | Карточка поля |
| POST | `/api/fields` | Создать |
| PUT | `/api/fields/{id}` | Обновить |
| DELETE | `/api/fields/{id}` | Удалить |
| GET | `/api/fields/{id}/passport` | Паспорт поля |
| POST | `/api/fields/{id}/passport/entries` | Запись паспорта |
| PUT | `/api/fields/{id}/passport/entries/{entryId}` | Обновить запись |
| DELETE | `/api/fields/{id}/passport/entries/{entryId}` | Удалить запись |
| POST | `/api/fields/{id}/passport/seasons` | Сезон |
| PUT | `/api/fields/{id}/passport/seasons/{resultId}` | Обновить сезон |
| DELETE | `/api/fields/{id}/passport/seasons/{resultId}` | Удалить сезон |
| GET | `/api/fields/{id}/satellite` | Данные спутника (прокси/агрегация со стороны field при необходимости) |
| GET | `/api/fields/{id}/finance` | Финансовый блок |

Swagger UI (dev): `http://localhost:8082/swagger-ui.html` (напрямую к контейнеру field-service).

### 4.3. weather-service — `/api/weather/fields`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/weather/fields/{fieldId}/current` | Текущая погода |
| GET | `/api/weather/fields/{fieldId}/historical` | История |
| GET | `/api/weather/fields/{fieldId}/forecast` | Прогноз |
| GET | `/api/weather/fields/{fieldId}/summary` | Сводка |
| POST | `/api/weather/fields/{fieldId}/coordinates` | Обновление координат поля в контексте погоды |

Источник данных: **Open-Meteo** (и при необходимости Archive). Синхронизация полей при старте — HTTP к field-service + Kafka `field-events`.

### 4.4. irrigation-service — `/api/irrigation`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/irrigation/fields/{fieldId}/tasks` | Задачи/рекомендации по полю |
| POST | `/api/irrigation/tasks` | Создать задачу |
| PATCH | `/api/irrigation/tasks/{id}/status?status=...` | Статус: `scheduled`, `active`, `completed`, `cancelled`, `skipped` |

Рекомендации также строятся/дублируются логикой в **analytics-service** (см. ниже); irrigation-service связан с Kafka и analytics URL из compose.

### 4.5. notification-service — `/api/alerts`

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/alerts` | Все алерты |
| GET | `/api/alerts/unread-count` | `{ "count": N }` |
| PATCH | `/api/alerts/{id}/read` | Пометить прочитанным |
| PATCH | `/api/alerts/read-all` | Все прочитаны |
| POST | `/api/alerts` | Ручное создание (type, severity, title, message, fieldId, fieldName) |

Severity: `critical`, `warning`, `info`.

### 4.6. analytics-service — клиентские пути `/api/analytics/...`

Внутренний путь = клиентский без префикса `/api/analytics`.

| Метод | Клиент (gateway) | Внутри FastAPI |
|-------|------------------|----------------|
| GET | `/api/analytics/health` | `/health` |
| GET | `/api/analytics/integrations` | `/integrations` |
| POST | `/api/analytics/integrations/{id}/connect` | `/integrations/{integration_id}/connect` |
| POST | `/api/analytics/integrations/{id}/disconnect` | `/integrations/{integration_id}/disconnect` |
| PUT | `/api/analytics/integrations/{id}/config` | `/integrations/{integration_id}/config` |
| GET | `/api/analytics/satellite/field/{field_id}/dates` | `/satellite/field/{field_id}/dates` |
| GET | `/api/analytics/satellite/field/{field_id}/series` | `/satellite/field/{field_id}/series` |
| GET | `/api/analytics/satellite/field/{field_id}/grid` | `/satellite/field/{field_id}/grid` |
| POST | `/api/analytics/forecast/yield` | `/forecast/yield` |
| GET | `/api/analytics/forecast/yield/field/{field_id}` | `/forecast/yield/field/{field_id}` |
| GET | `/api/analytics/yield/historical/{field_id}` | `/yield/historical/{field_id}` |
| GET | `/api/analytics/irrigation/recommendations/{field_id}` | `/irrigation/recommendations/{field_id}` |
| GET | `/api/analytics/irrigation/schedule/{field_id}` | `/irrigation/schedule/{field_id}` |
| POST | `/api/analytics/anomaly/detect` | `/anomaly/detect` |
| GET | `/api/analytics/model/metrics` | `/model/metrics` |
| POST | `/api/analytics/scenario/what-if` | `/scenario/what-if` |
| GET | `/api/analytics/dataset/generate` | `/dataset/generate` |
| GET | `/api/analytics/dataset/eda` | `/dataset/eda` |
| GET | `/api/analytics/dataset/field/{field_id}` | `/dataset/field/{field_id}` |
| POST | `/api/analytics/iot/telemetry` | `/iot/telemetry` |
| GET | `/api/analytics/ops/work-tasks` | `/ops/work-tasks` |
| POST | `/api/analytics/ops/work-tasks` | `/ops/work-tasks` |
| PUT | `/api/analytics/ops/work-tasks/{task_id}` | `/ops/work-tasks/{task_id}` |
| GET | `/api/analytics/ops/equipment` | `/ops/equipment` |
| POST | `/api/analytics/ops/equipment` | `/ops/equipment` |
| PUT | `/api/analytics/ops/equipment/{device_id}` | `/ops/equipment/{device_id}` |
| DELETE | `/api/analytics/ops/equipment/{device_id}` | `/ops/equipment/{device_id}` |
| GET | `/api/analytics/sensors/connectors` | `/sensors/connectors` |
| POST | `/api/analytics/sensors/connectors` | `/sensors/connectors` |
| PUT | `/api/analytics/sensors/connectors/{connector_id}` | `/sensors/connectors/{connector_id}` |
| DELETE | `/api/analytics/sensors/connectors/{connector_id}` | `/sensors/connectors/{connector_id}` |
| POST | `/api/analytics/sensors/probe` | `/sensors/probe` |
| POST | `/api/analytics/sensors/connectors/{connector_id}/test` | `/sensors/connectors/{connector_id}/test` |
| POST | `/api/analytics/sensors/webhook/{connector_id}` | `/sensors/webhook/{connector_id}` |
| GET | `/api/analytics/ops/audit-log` | `/ops/audit-log` |
| GET | `/api/analytics/ops/notification-rules` | `/ops/notification-rules` |
| POST | `/api/analytics/ops/notification-rules` | `/ops/notification-rules` |
| PUT | `/api/analytics/ops/notification-rules/{rule_id}` | `/ops/notification-rules/{rule_id}` |
| DELETE | `/api/analytics/ops/notification-rules/{rule_id}` | `/ops/notification-rules/{rule_id}` |
| GET | `/api/analytics/ops/reports/history` | `/ops/reports/history` |
| GET | `/api/analytics/ops/reports/history/{report_id}/download` | `/ops/reports/history/{report_id}/download` |
| GET | `/api/analytics/ops/reports/scheduled` | `/ops/reports/scheduled` |
| POST | `/api/analytics/ops/reports/scheduled` | `/ops/reports/scheduled` |
| PATCH | `/api/analytics/ops/reports/scheduled/{schedule_id}` | `/ops/reports/scheduled/{schedule_id}` |
| DELETE | `/api/analytics/ops/reports/scheduled/{schedule_id}` | `/ops/reports/scheduled/{schedule_id}` |
| POST | `/api/analytics/ops/reports/generate` | `/ops/reports/generate` |

Интерактивная документация OpenAPI: `http://localhost:8000/docs` (прямой доступ к контейнеру analytics в dev).

---

## 5. PostgreSQL: базы данных

Один инстанс Postgres, скрипт инициализации: `scripts/init-db.sql`.

| База | Сервис |
|------|--------|
| `authdb` | Пользователи, роли, инвайты, сессии/верификация |
| `fielddb` | Поля, паспорт, связанные сущности |
| `weatherdb` | Кэш/записи погоды |
| `irrigationdb` | Задачи полива |
| `notificationdb` | Алерты |
| `analyticsdb` | Данные analytics (отчёты, расписания, интеграции и т.д. по реализации) |

Смена пароля суперпользователя БД в `.env` **после** первого создания тома **не** обновляет пароль внутри уже инициализированного кластера — см. README и `.env.example`.

---

## 6. Docker: именованные тома

| Том (имя по умолчанию с префиксом проекта) | Назначение |
|--------------------------------------------|------------|
| `postgres_data` | Данные PostgreSQL |
| `kafka_kraft_data` | Данные Kafka KRaft |
| `grafana_data` | Настройки и дашборды Grafana |
| `analytics_reports` | Файлы сгенерированных отчётов (`REPORTS_STORAGE_DIR`) |

---

## 7. Kafka: топики и потоки событий

| Топик | Продюсер | Потребители (типично) |
|-------|----------|------------------------|
| `weather-data` | weather-service | analytics-service, irrigation-service, notification-service |
| `field-events` | field-service | (расширяемо) |
| `irrigation-recommendations` | irrigation-service | notification-service |
| `forecast-results` | analytics-service | notification-service |

Автосоздание топиков включено (`KAFKA_AUTO_CREATE_TOPICS_ENABLE`).

---

## 8. Мониторинг и метрики

- **Prometheus** скрейпит `/actuator/prometheus` у JVM-сервисов (см. `monitoring/prometheus.yml`). Имена хостов — Docker network (`api-gateway:8080`, …).
- **Grafana** провижининг из `monitoring/grafana/`.
- **analytics-service** (Python) в том же compose может не попадать в `prometheus.yml` — при необходимости добавьте job вручную.

---

## 9. Фронтенд: слои и алиасы

Каталог `frontend/src`:

| Папка | Назначение |
|-------|------------|
| `domain/` | Сущности, типы домена |
| `application/` | Redux store, slices, thunks |
| `infrastructure/` | Axios-клиент, API-модули |
| `presentation/` | Страницы, layout, компоненты, SCSS modules |

Импорт-алиасы (см. `vite.config.ts`, `tsconfig.json`): `@domain`, `@application`, `@infrastructure`, `@presentation`, `@`.

---

## 10. Маршруты SPA (React Router)

Публичные: `/`, `/about-service`, `/about-app`, `/docs`, `/privacy`, `/auth/*`.

Защищённые (обёртка `PrivateRoute`, префикс `/app`): см. [README.md](../README.md#возможности) — перечислены все вложенные пути (`fields`, `forecast`, …).

Fallback: неизвестный путь → редирект на `/`.

---

## 11. Nginx (production-образ фронта)

Файл `frontend/nginx.conf`:

- `try_files` для SPA.
- `location /api/` → `proxy_pass http://api-gateway:8080` с сохранением реального `Origin` (важно для CORS).

---

## 12. ML и качество модели

Подробно:

- [mlModel.md](./mlModel.md) — алгоритм, фичи, confidence, ограничения PoC.
- [ML_TESTING.md](./ML_TESTING.md) — как запускать проверки и что означают метрики.

---

## 13. CI (GitHub Actions)

Файл `.github/workflows/ci.yml`: frontend build + `mvn verify` для Java-сервисов. **analytics-service** в CI по умолчанию не включён — при доработке добавьте job (lint/test/установка зависимостей из `requirements.txt`).

---

## 14. Чек-лист перед production

- [ ] Уникальные сильные `JWT_SECRET`, `INTERNAL_API_TOKEN`, пароли Postgres и bootstrap-пользователей.
- [ ] `APP_CORS_ALLOWED_ORIGINS` и `FRONTEND_URL` совпадают с реальным URL пользователей.
- [ ] Почта/Telegram настроены, если нужны письма и внешние алерты.
- [ ] Закрыты лишние порты (`docker-compose.prod.yml`).
- [ ] Резервное копирование тома `postgres_data`.
- [ ] Просмотрены лимиты rate-limit регистрации и политика invite-кодов.

---

*Документ генерируется по состоянию репозитория; при изменении контроллеров или `main.py` сверяйте таблицы с кодом.*
