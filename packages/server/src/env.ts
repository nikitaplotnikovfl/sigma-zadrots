import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Корневой .env (содержит FACEIT_API_KEY) + локальный .env пакета.
config({ path: resolve(__dirname, '../../../.env') })
config({ path: resolve(__dirname, '../.env') })

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Не задана переменная окружения ${name}`)
  return v
}

export const env = {
  faceitApiKey: required('FACEIT_API_KEY'),
  hubId: required('HUB_ID'),
  adminToken: process.env.ADMIN_TOKEN ?? 'changeme',
  port: Number(process.env.PORT ?? 3000),
  syncCron: process.env.SYNC_INTERVAL_CRON ?? '0 12 * * 3', // по средам 12:00
  syncTz: process.env.SYNC_TZ ?? 'UTC',
  pageLimit: Number(process.env.SYNC_PAGE_LIMIT ?? 100),
  minIntervalMs: Number(process.env.SYNC_MIN_INTERVAL_MS ?? 600),
  // Таймаут одного запроса к FACEIT (мс) — защита от зависания синка.
  requestTimeoutMs: Number(process.env.FACEIT_TIMEOUT_MS ?? 20000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  isProd: process.env.NODE_ENV === 'production',
  // Минимум матчей (игр по картам), чтобы игрок попал в общий лидерборд.
  leaderboardMinMatches: Number(process.env.LEADERBOARD_MIN_MATCHES ?? 10),
  // Разрыв (дней) между матчами, с которого начинается новый турнир (для движения в рейтинге).
  tournamentGapDays: Number(process.env.TOURNAMENT_GAP_DAYS ?? 14),
}
