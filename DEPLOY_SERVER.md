# Deploy to Remote Server

Target server IP: `45.94.122.52`

This guide prepares and runs the project in production-like mode using Docker Compose.

## 1) Server requirements

- Ubuntu 22.04+ (recommended)
- 8 vCPU / 16 GB RAM / 200 GB SSD (baseline for stability)
- Open ports: `22` (SSH), `80` (HTTP)
- Domain is optional; app can run on raw IP

## 2) Install Docker on server

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3) Upload project

From local machine:

```bash
scp -r /Users/maxim/Desktop/hackOff2/techno-demo <user>@45.94.122.52:~/
```

Or use git clone on server.

## 4) Configure environment on server

```bash
cd ~/techno-demo
cp .env.example .env
```

Edit `.env`:

- Set strong values for:
  - `POSTGRES_USER` and `POSTGRES_PASSWORD` — **must match the very first values used when the Postgres Docker volume was created** (see warning below)
  - `JWT_SECRET`
  - `INTERNAL_API_TOKEN`
  - `BOOTSTRAP_ADMIN_PASSWORD`
  - `BOOTSTRAP_AGRONOMIST_PASSWORD`
- Set CORS/URLs for your server IP:
  - `APP_CORS_ALLOWED_ORIGINS=http://45.94.122.52`
  - `FRONTEND_URL=http://45.94.122.52`

**Postgres volume warning:** `scripts/init-db.sql` and role creation run **only on first** `postgres_data` volume init. If you later change `POSTGRES_USER` / `POSTGRES_PASSWORD` in `.env`, services will log `password authentication failed for user "..."` and stay unhealthy. Fix: either **revert `.env` to the original user/password**, or **remove the volume** (all DB data lost) and start again:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker volume rm techno-demo_postgres_data
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 5) Start in production mode

```bash
cd ~/techno-demo
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Check health:

```bash
docker compose ps
docker compose logs -f --tail=100
```

## 6) Open application

- Web app: `http://45.94.122.52`

## 7) Update deployment

```bash
cd ~/techno-demo
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 8) Backup minimum (recommended)

Postgres data volume:

```bash
docker run --rm -v techno-demo_postgres_data:/volume -v $(pwd):/backup alpine \
  tar czf /backup/postgres_data_$(date +%F).tar.gz -C /volume .
```

## 9) Security checklist

- Keep only `22` and `80` open in firewall.
- Do not expose Kafka, Postgres, Grafana, Prometheus publicly.
- Use strong secrets in `.env`.
- Rotate `JWT_SECRET` and `INTERNAL_API_TOKEN` periodically.

## 10) Если Kafka «unhealthy» (`dependency failed to start`)

В проекте используется **Kafka KRaft** (**`confluentinc/cp-kafka`**, **без Zookeeper**) — нет рассинхрона `cluster.id` между ZK и брокером, как в старом стеке Confluent+ZK.

1. Логи:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml logs kafka --tail=200
   ```
2. Частые причины:
   - **мало RAM** — `KAFKA_HEAP_OPTS: "-Xmx512M -Xms256M"`; при OOM в логах `OutOfMemoryError`.
   - **долгий первый старт** — `start_period` healthcheck до **180s**; подождите 2–3 минуты.
   - **после обновления с Confluent+ZK или с эксперимента Bitnami**: том **`techno-demo_kafka_kraft_data`** должен соответствовать текущему образу; при ошибках старта брокера удалите его (`docker volume rm techno-demo_kafka_kraft_data`) и поднимите стек снова. Старые `techno-demo_kafka_data` / `techno-demo_zookeeper_data` при желании тоже удалите, чтобы освободить место.
3. После `git pull` на сервере:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
4. Сброс данных брокера (очереди Kafka обнулятся):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down
   docker volume rm techno-demo_kafka_kraft_data
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

5. **`field-service` (или любой сервис с JPA): `password authentication failed for user "agro_user"`**  
   Несовпадение логина/пароля Postgres с тем, что записано в **существующем** томе `postgres_data`. Поставьте в `.env` те же `POSTGRES_USER` / `POSTGRES_PASSWORD`, что были при **первом** `docker compose up`, либо удалите том `techno-demo_postgres_data` и поднимите стек заново (данные БД обнулятся). См. предупреждение в разделе **4) Configure environment**.

6. **`field-service` / другие Java-сервисы unhealthy из‑за healthcheck**  
   Образ `eclipse-temurin:*-jre` **не содержит `wget`**. Старый healthcheck в compose вызывал `wget` → проверка всегда падала. В актуальной версии в JRE-образы добавлен `curl`, healthcheck переведён на `curl`. Пересоберите сервисы:
   ```bash
   git pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache field-service
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

7. **`analytics-service` unhealthy**  
   Раньше Uvicorn не открывал порт, пока не завершалось обучение ML при старте. В актуальной версии обучение идёт в фоне, `/health` отвечает сразу. Обновите код и пересоберите:
   ```bash
   git pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build analytics-service
   ```

8. **Kafka помечается `unhealthy`, `dependency failed`**  
   См. раздел **10) Если Kafka «unhealthy»** выше (KRaft, том `kafka_kraft_data`). Быстрый сброс: `./scripts/reset-kafka-volumes.sh`  

9. **Старый стек Confluent + Zookeeper (до миграции на KRaft)**  
   Если в логах ещё встречается **`InconsistentClusterIdException`** на старом деплое — обновите репозиторий и поднимите актуальный compose; при необходимости удалите старые тома: `techno-demo_kafka_data`, `techno-demo_zookeeper_data`.

10. **Белый экран в браузере после открытия `http://<IP>/`**  
   Частые причины:
   - В консоли: **`Cannot destructure property 'store' ... as it is null`** — хуки Redux не видят `<Provider>` (часто из‑за **двух копий** `react-redux`/`react` в production-бандле). В актуальной версии фронта: `Provider` вынесен в `main.tsx`, в `vite.config.ts` добавлен `resolve.dedupe`. Пересоберите образ frontend и обновите страницу.
   - **Service Worker** отдал старый `index.html` со старыми путями `/assets/*.js` после нового деплоя. В актуальной версии фронта SW обновлён (сеть для HTML и `/assets/`, `sw.js` кладётся в `public/` и попадает в образ). Пересоберите frontend:  
     `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend`  
     У себя в браузере: жёсткое обновление (**Ctrl+Shift+R** / **Cmd+Shift+R**) или DevTools → Application → Service Workers → **Unregister**, затем обновить страницу.
   - **Ошибка в консоли** (F12 → Console): если видите падение до рендера — пришлите текст ошибки. Битый JSON в `localStorage` для `user`/`tokens` теперь очищается при старте приложения.

11. **`403 Forbidden` на `/api/auth/register` (и другие API)**  
   Браузер шлёт **`Origin: http://<IP>`** даже когда страница и `/api` на **одном хосте** (через nginx). Spring CORS на **gateway/auth** может ответить **403**, если origin не в белом списке.  
   **Исправление (рекомендуется):** в актуальной версии **nginx** фронта для `location /api/` задано **`proxy_set_header Origin ""`** — заголовок **не уходит** в gateway, запрос не считается CORS и **403 из‑за CORS пропадает**. Пересоберите только frontend:  
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend`  
   Дополнительно можно указать в `.env`: **`FRONTEND_URL=http://ВАШ_IP`** (ссылки в письмах) и при прямом доступе к gateway (без nginx): **`APP_CORS_ALLOWED_ORIGINS=http://ВАШ_IP,...`** или шаблоны в профиле **docker** (`http://*,https://*`).

