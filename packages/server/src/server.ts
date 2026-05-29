import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticPlugin from '@fastify/static'
import cron from 'node-cron'
import { z } from 'zod'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.js'
import { env } from './env.js'
import { logger } from './logger.js'
import { syncSource } from './sync.js'
import { mapsOverview } from './maps.js'
import { leaderboardByMap } from './statsQuery.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = Fastify({ logger })
await app.register(cors, { origin: true })

// Единый обработчик ошибок хендлеров: логируем с контекстом, отдаём чистый JSON.
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err, url: req.raw.url }, 'request handler error')
  reply.code(err.statusCode ?? 500).send({ error: err.statusCode ? err.message : 'internal error' })
})

// ---- whitelist сортируемых колонок лидерборда ----
const SORTABLE = [
  'rating', 'matches', 'winrate', 'kd', 'kr', 'adr', 'hsPct', 'kills', 'deaths', 'assists', 'mvps',
] as const
type Sortable = (typeof SORTABLE)[number]

const leaderboardQuery = z.object({
  map: z.string().trim().min(1).optional(),
  sort: z.enum(SORTABLE as unknown as [Sortable, ...Sortable[]]).default('rating'),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().optional(),
  minMatches: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

app.get('/api/health', async () => ({ ok: true }))

app.get('/api/sources', async () => prisma.source.findMany())

app.get('/api/sync/status', async () => {
  const last = await prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } })
  const counts = {
    matches: await prisma.match.count(),
    players: await prisma.playerAggregate.count(),
  }
  return { last, ...counts }
})

app.get('/api/leaderboard', async (req, reply) => {
  const parsed = leaderboardQuery.safeParse(req.query)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  const { map, sort, order, q, minMatches, page, pageSize } = parsed.data

  // С фильтром по карте — агрегаты считаются на лету из PlayerMatchStats.
  if (map) {
    const { total, items } = await leaderboardByMap(map, { sort, order, q, minMatches, page, pageSize })
    return { total, page, pageSize, sort, order, items }
  }

  const where = {
    matches: { gte: minMatches },
    ...(q ? { player: { nickname: { contains: q } } } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.playerAggregate.count({ where }),
    prisma.playerAggregate.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { player: true },
    }),
  ])

  const items = rows.map((r, i) => ({
    rank: (page - 1) * pageSize + i + 1,
    playerId: r.playerId,
    nickname: r.player.nickname,
    avatar: r.player.avatar,
    country: r.player.country,
    matches: r.matches,
    wins: r.wins,
    winrate: r.winrate,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    kd: r.kd,
    kr: r.kr,
    adr: r.adr,
    hsPct: r.hsPct,
    mvps: r.mvps,
    rating: r.rating,
  }))

  return { total, page, pageSize, sort, order, items }
})

app.get('/api/maps', async () => ({ items: await mapsOverview() }))

app.get('/api/players/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const player = await prisma.player.findUnique({
    where: { id },
    include: { aggregate: true },
  })
  if (!player) return reply.code(404).send({ error: 'player not found' })

  const stats = await prisma.playerMatchStats.findMany({
    where: { playerId: id },
    orderBy: { finishedAt: 'desc' },
    take: 50,
  })

  const history = stats.map((s) => ({
    matchId: s.matchId,
    map: s.mapName,
    won: s.won,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    kd: s.kd,
    kr: s.kr,
    adr: s.adr,
    hsPct: s.hsPct,
    finishedAt: s.finishedAt,
  }))

  return { player: { ...player, aggregate: undefined }, aggregate: player.aggregate, history }
})

app.get('/api/matches', async (req) => {
  const { page = '1', pageSize = '30' } = req.query as Record<string, string>
  const p = Math.max(1, Number(page))
  const ps = Math.min(100, Math.max(1, Number(pageSize)))
  const [total, rows] = await Promise.all([
    prisma.match.count(),
    prisma.match.findMany({
      orderBy: { finishedAt: 'desc' },
      skip: (p - 1) * ps,
      take: ps,
    }),
  ])
  return {
    total,
    page: p,
    pageSize: ps,
    items: rows.map((m) => ({
      id: m.id,
      region: m.region,
      bestOf: m.bestOf,
      finishedAt: m.finishedAt,
      winnerTeamId: m.winnerTeamId,
      teams: m.teamsJson ? JSON.parse(m.teamsJson) : [],
    })),
  }
})

app.get('/api/matches/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) return reply.code(404).send({ error: 'match not found' })
  const stats = await prisma.playerMatchStats.findMany({
    where: { matchId: id },
    include: { player: true },
  })
  return {
    match: {
      id: match.id,
      region: match.region,
      bestOf: match.bestOf,
      finishedAt: match.finishedAt,
      winnerTeamId: match.winnerTeamId,
      teams: match.teamsJson ? JSON.parse(match.teamsJson) : [],
      maps: match.mapsJson ? JSON.parse(match.mapsJson) : [],
    },
    stats: stats.map((s) => ({
      playerId: s.playerId,
      nickname: s.player.nickname,
      teamId: s.teamId,
      teamName: s.teamName,
      mapNum: s.mapNum,
      mapName: s.mapName,
      won: s.won,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      kd: s.kd,
      kr: s.kr,
      adr: s.adr,
      hsPct: s.hsPct,
      mvps: s.mvps,
    })),
  }
})

// ---- защищённый ручной синк ----
app.post('/api/sync', async (req, reply) => {
  if (req.headers['x-admin-token'] !== env.adminToken) {
    return reply.code(401).send({ error: 'unauthorized' })
  }
  const result = await syncSource()
  return result
})

// ---- отдача собранного фронтенда (прод: один сервис отдаёт API + SPA) ----
// STATIC_DIR задаётся в Docker/прод; локально пытаемся найти ../../web/dist.
const staticDir = process.env.STATIC_DIR ?? resolve(__dirname, '../../web/dist')
if (existsSync(staticDir)) {
  await app.register(staticPlugin, { root: staticDir, wildcard: false })
  // SPA-фолбэк: всё, что не /api и не статика, отдаёт index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) {
      return reply.code(404).send({ error: 'not found' })
    }
    return reply.sendFile('index.html')
  })
  app.log.info(`serving static frontend from ${staticDir}`)
}

// ---- расписание ----
cron.schedule(env.syncCron, async () => {
  app.log.info('cron sync start')
  const r = await syncSource()
  app.log.info({ r }, 'cron sync done')
})

app
  .listen({ port: env.port, host: '0.0.0.0' })
  .then(() => app.log.info(`SIGMA ZADROTS API on :${env.port}`))
  .catch((e) => {
    app.log.error(e)
    process.exit(1)
  })
