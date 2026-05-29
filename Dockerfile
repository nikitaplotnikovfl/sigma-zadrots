# SIGMA ZADROTS — один образ: собирает фронт и запускает API+воркер, отдающий статику.
# Контекст сборки — корень репозитория.

# 1) Сборка фронтенда
FROM node:20-slim AS web
WORKDIR /web
COPY packages/web/package.json packages/web/package-lock.json* ./
RUN npm install
COPY packages/web/ ./
RUN npm run build

# 2) Сервер + зависимости
FROM node:20-slim AS server-deps
WORKDIR /app
# openssl нужен Prisma engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY packages/server/package.json packages/server/package-lock.json* ./
COPY packages/server/prisma ./prisma
# postinstall запустит prisma generate (нужен schema.prisma)
RUN npm install

# 3) Финальный образ
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=server-deps /app/node_modules ./node_modules
COPY packages/server/ ./
# собранный фронт кладём внутрь образа и указываем серверу путь
COPY --from=web /web/dist ./public
ENV STATIC_DIR=/app/public
ENV PORT=3000
EXPOSE 3000
# применяем миграции и стартуем API+cron-воркер
CMD ["npm", "run", "start:prod"]
