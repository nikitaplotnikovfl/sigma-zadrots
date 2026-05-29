# Деплой SIGMA ZADROTS (Railway + Neon)

Один сервис на Railway: Docker-образ собирает фронт и запускает API+cron-воркер,
который ОТДАЁТ и `/api`, и SPA (один origin, без CORS, без второго деплоя).
БД — Neon Postgres.

## 0. Что меняется относительно локалки
- Prisma-провайдер переключён на **postgresql** (был sqlite-стопгап).
- Локальная разработка теперь тоже на Postgres (Neon dev-ветка) — Docker для БД не нужен.
- Сервер в проде отдаёт собранный фронт из `STATIC_DIR` (в образе — `/app/public`).

## 1. Neon (БД)
1. Заведи проект на neon.tech → создай базу.
2. Скопируй connection string вида
   `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`.
3. Положи его в корневой `.env` как `DATABASE_URL=...` (и продублируй в `packages/server/.env`,
   либо убери оттуда строку `DATABASE_URL=file:...`, чтобы не перетирала корневую).

## 2. Инициализация схемы и данных (локально, против Neon)
```bash
cd packages/server
npm install
npm run migrate:dev -- --name init   # создаст prisma/migrations + применит к Neon
npm run sync                          # первичный сбор матчей хаба
npm start                             # проверка API локально
```
Папка `prisma/migrations/**` коммитится в git — она нужна для `migrate deploy` в проде.

## 3. Railway (хостинг)
1. Запушь репозиторий на GitHub.
2. Railway → New Project → Deploy from GitHub repo. Сборка возьмётся из `Dockerfile`
   (см. `railway.json`: builder=DOCKERFILE, healthcheck=`/api/health`).
3. В Variables задай переменные окружения (Railway сам прокинет `PORT`):
   - `FACEIT_API_KEY` — server-side ключ FACEIT
   - `DATABASE_URL` — connection string Neon
   - `HUB_ID` — `d0701937-8eba-4df9-8830-22137001c0bd`
   - `ADMIN_TOKEN` — свой секрет
   - (необязательно) `SYNC_INTERVAL_CRON`, `SYNC_PAGE_LIMIT`, `SYNC_MIN_INTERVAL_MS`
4. Deploy. Старт-команда `npm run start:prod` применит миграции (`migrate deploy`) и поднимет сервис.
5. Первичный сбор: дождись cron (каждые 10 мин) или дёрни вручную:
   ```bash
   curl -X POST -H "X-Admin-Token: <ADMIN_TOKEN>" https://<твой-домен>.up.railway.app/api/sync
   ```
6. Открой выданный Railway URL — фронт и API на одном домене.

## 4. Локальная сборка образа (опционально, нужен Docker)
```bash
docker build -t sigma-zadrots .
docker run --rm -p 3000:3000 \
  -e FACEIT_API_KEY=... -e DATABASE_URL=... \
  -e HUB_ID=d0701937-8eba-4df9-8830-22137001c0bd -e ADMIN_TOKEN=... \
  sigma-zadrots
# открыть http://localhost:3000
```

## CI/CD (GitHub Actions)

В `.github/workflows/` лежат два пайплайна:

- **ci.yml** — на каждый push в `main` и PR: типчек + тесты сервера (`packages/server`) и сборка
  фронта (`packages/web`) на Node 20. Реальная БД не нужна (тесты — чистые функции).
- **deploy.yml** — деплой на Railway после успешного CI на `main`.

Чтобы deploy.yml работал, в репозитории (Settings → Secrets and variables → Actions):
- **Secret** `RAILWAY_TOKEN` — токен проекта Railway (Railway → Project → Settings → Tokens).
- **Variable** `RAILWAY_SERVICE` — имя сервиса в Railway (напр. `sigma-zadrots`).

> Альтернатива: если подключить репозиторий через нативную GitHub-интеграцию Railway, деплой
> пойдёт автоматически при push — тогда `deploy.yml` не нужен, можно удалить.

## Заметки
- Healthcheck: `GET /api/health` → `{ ok: true }`.
- Воркер-синк живёт в том же процессе (node-cron). Для масштабирования позже можно вынести
  в отдельный сервис + Redis/BullMQ.
- Фронт собирается в образе; отдельный деплой фронта не требуется.
