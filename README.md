# SIGMA ZADROTS

Статистика турниров FACEIT Hub по CS2: сбор матчей, агрегация, неоновый лидерборд
с сортировкой/фильтрацией, страница игрока и матчей, авто-обновление.

Документы: [ТЗ](docs/SPEC.md) · [План/агенты](docs/PLAN.md) · [Дизайн](docs/DESIGN.md)

## Структура

```
packages/
  web/      # Vite + React + TS + Tailwind — фронтенд (неон-стилистика)
  server/   # Prisma + FACEIT-клиент + сборщик + Fastify API + cron (MVP-монолит)
```

## Запуск

Корневой `.env` должен содержать `FACEIT_API_KEY=<server-side ключ FACEIT>`.

**Бэкенд** (порт 3000):
```bash
cd packages/server
npm install
npm run db:push        # создать SQLite-схему (prisma/dev.db)
npm run start          # API + cron-синк
npm run sync           # разовый сбор данных вручную
```

**Фронтенд** (порт 5173, проксирует /api → :3000):
```bash
cd packages/web
npm install
npm run dev
```

## Важно про источник

Хаб должен быть **опубликован** (`published: true`) на FACEIT — иначе публичный Data API
не отдаёт его матчи. Текущий `HUB_ID` задан в `packages/server/.env`.

Пока данных нет, фронт показывает демо-лидерборд с бейджем **DEMO**; после успешного
синка — **● LIVE** с реальными данными.

## API (основное)

- `GET /api/leaderboard?sort=&order=&q=&minMatches=&page=&pageSize=`
- `GET /api/players/:id` · `GET /api/matches` · `GET /api/matches/:id`
- `GET /api/sources` · `GET /api/sync/status`
- `POST /api/sync` (заголовок `X-Admin-Token`) — ручной синк
