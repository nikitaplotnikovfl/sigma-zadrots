import { prisma } from './db.js'

// ---- Форма игрока: последние до 10 карт, свежие первыми ----
export interface FormEntry {
  matchId: string
  mapName: string | null
  won: boolean
  kd: number
  adr: number
  finishedAt: Date | null
}

export async function playerForm(playerId: string): Promise<FormEntry[]> {
  const rows = await prisma.playerMatchStats.findMany({
    where: { playerId },
    orderBy: { finishedAt: 'desc' },
    take: 10,
    select: { matchId: true, mapName: true, won: true, kd: true, adr: true, finishedAt: true },
  })
  return rows.map((r) => ({
    matchId: r.matchId,
    mapName: r.mapName,
    won: r.won,
    kd: r.kd,
    adr: r.adr,
    finishedAt: r.finishedAt,
  }))
}

// ---- Текущая серия от самого свежего матча ----
export interface Streak {
  type: 'W' | 'L'
  count: number
}

/**
 * Чистая функция: принимает строки, отсортированные от самой свежей к старой,
 * считает текущую серию по полю won. null если нет матчей.
 */
export function playerStreak(rows: { won: boolean }[]): Streak | null {
  if (!rows.length) return null
  const type: 'W' | 'L' = rows[0].won ? 'W' : 'L'
  let count = 0
  for (const r of rows) {
    if (r.won === rows[0].won) count++
    else break
  }
  return { type, count }
}

// ---- Разбивка по картам игрока ----
export interface MapBreakdown {
  map: string
  matches: number
  wins: number
  winrate: number
  kd: number
  adr: number
  hsPct: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export async function playerMaps(playerId: string): Promise<MapBreakdown[]> {
  const rows = await prisma.playerMatchStats.findMany({
    where: { playerId },
    select: { mapName: true, won: true, kills: true, deaths: true, headshots: true, adr: true },
  })

  const byMap = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.mapName) continue
    const list = byMap.get(r.mapName) ?? []
    list.push(r)
    byMap.set(r.mapName, list)
  }

  const out: MapBreakdown[] = []
  for (const [map, list] of byMap) {
    const matches = list.length
    const wins = list.filter((r) => r.won).length
    const winrate = matches ? +((wins / matches) * 100).toFixed(1) : 0
    const kills = sum(list.map((r) => r.kills))
    const deaths = sum(list.map((r) => r.deaths))
    const headshots = sum(list.map((r) => r.headshots))
    const kd = deaths ? +(kills / deaths).toFixed(2) : kills
    const adr = +avg(list.map((r) => r.adr)).toFixed(1)
    const hsPct = kills ? +((headshots / kills) * 100).toFixed(1) : 0
    out.push({ map, matches, wins, winrate, kd, adr, hsPct })
  }

  out.sort((a, b) => b.matches - a.matches || a.map.localeCompare(b.map))
  return out
}

// ---- Расширенная статистика игрока (производные метрики) ----
export interface ExtendedStats {
  rounds: number
  perMatch: { kills: number; deaths: number; assists: number }
  kpr: number // килов в раунд (kills / rounds)
  dpr: number // смертей в раунд
  mvpRate: number // MVP за матч
  multiKills: { double: number; triple: number; quadro: number; penta: number }
  multiKillFrags: number // 2·2K + 3·3K + 4·4K + 5·5K — вклад мультикиллов
  consistency: { stdev: number; score: number } // разброс рейтинга по матчам; score 0..100 (выше = ровнее)
}

interface AggForExtended {
  matches: number
  kills: number
  deaths: number
  assists: number
  mvps: number
  rounds: number
  doubleKills: number
  tripleKills: number
  quadroKills: number
  pentaKills: number
}

export async function playerExtended(
  playerId: string,
  agg: AggForExtended | null | undefined,
): Promise<ExtendedStats | null> {
  if (!agg || !agg.matches) return null
  const { hltvRating } = await import('./aggregate.js')

  const m = agg.matches
  const rounds = agg.rounds
  const round = (v: number, d = 2) => +v.toFixed(d)

  // стабильность: std HLTV-рейтинга по картам (per-card rating по реальным раундам карты)
  const rows = await prisma.playerMatchStats.findMany({
    where: { playerId },
    select: {
      kills: true,
      deaths: true,
      rounds: true,
      doubleKills: true,
      tripleKills: true,
      quadroKills: true,
      pentaKills: true,
    },
  })
  const ratings = rows.map((r) =>
    hltvRating(r.kills, r.deaths, r.rounds, {
      double: r.doubleKills,
      triple: r.tripleKills,
      quadro: r.quadroKills,
      penta: r.pentaKills,
    }),
  )
  const mean = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const variance = ratings.length
    ? ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length
    : 0
  const stdev = Math.sqrt(variance)
  // score: 1.0 std → 0, 0 std → 100 (клампим)
  const score = Math.max(0, Math.min(100, Math.round((1 - stdev) * 100)))

  return {
    rounds,
    perMatch: {
      kills: round(agg.kills / m, 1),
      deaths: round(agg.deaths / m, 1),
      assists: round(agg.assists / m, 1),
    },
    kpr: rounds ? round(agg.kills / rounds) : 0,
    dpr: rounds ? round(agg.deaths / rounds) : 0,
    mvpRate: round(agg.mvps / m),
    multiKills: {
      double: agg.doubleKills,
      triple: agg.tripleKills,
      quadro: agg.quadroKills,
      penta: agg.pentaKills,
    },
    multiKillFrags:
      2 * agg.doubleKills + 3 * agg.tripleKills + 4 * agg.quadroKills + 5 * agg.pentaKills,
    consistency: { stdev: round(stdev, 3), score },
  }
}

// ---- Дуэли: Entry/Opening и клатчи (чисто из агрегата) ----
export interface DuelStats {
  entryCount: number
  entryWins: number
  entrySuccess: number // entryWins/entryCount*100, 1 знак
  firstKills: number
  firstKillsPerMatch: number // firstKills/matches, 1 знак
  clutchKills: number
  clutch1v1: { count: number; wins: number; rate: number }
  clutch1v2: { count: number; wins: number; rate: number }
}

interface AggForDuels {
  matches: number
  entryCount: number
  entryWins: number
  firstKills: number
  clutchKills: number
  clutch1v1Count: number
  clutch1v1Wins: number
  clutch1v2Count: number
  clutch1v2Wins: number
}

export function playerDuels(
  _playerId: string,
  agg: AggForDuels | null | undefined,
): DuelStats | null {
  if (!agg || !agg.matches) return null
  const rate = (wins: number, count: number) => (count ? +((wins / count) * 100).toFixed(1) : 0)
  return {
    entryCount: agg.entryCount,
    entryWins: agg.entryWins,
    entrySuccess: rate(agg.entryWins, agg.entryCount),
    firstKills: agg.firstKills,
    firstKillsPerMatch: +(agg.firstKills / agg.matches).toFixed(1),
    clutchKills: agg.clutchKills,
    clutch1v1: {
      count: agg.clutch1v1Count,
      wins: agg.clutch1v1Wins,
      rate: rate(agg.clutch1v1Wins, agg.clutch1v1Count),
    },
    clutch1v2: {
      count: agg.clutch1v2Count,
      wins: agg.clutch1v2Wins,
      rate: rate(agg.clutch1v2Wins, agg.clutch1v2Count),
    },
  }
}

// ---- Пиковый рейтинг = лучший рейтинг за ОТДЕЛЬНЫЙ турнир ----
/**
 * Накопительный (текущий) рейтинг почти не колеблется со временем, поэтому «пик» по нему
 * всегда равен текущему и бесполезен. Вместо этого считаем рейтинг игрока ВНУТРИ каждого
 * турнира (кластер матчей по дате) и берём максимум. fallback (текущий rating) — если
 * у игрока нет матчей/турниров.
 */
export async function peakRating(playerId: string, fallback: number): Promise<number> {
  const { detectTournaments } = await import('./tournaments.js')
  const { aggregateRows } = await import('./statsQuery.js')

  const periods = await detectTournaments()
  if (!periods.length) return fallback

  const rows = await prisma.playerMatchStats.findMany({
    where: { playerId, finishedAt: { not: null } },
    select: {
      playerId: true,
      won: true,
      kills: true,
      deaths: true,
      assists: true,
      kr: true,
      adr: true,
      headshots: true,
      mvps: true,
      rounds: true,
      doubleKills: true,
      tripleKills: true,
      quadroKills: true,
      pentaKills: true,
      finishedAt: true,
      player: { select: { nickname: true, avatar: true, country: true } },
    },
  })
  if (!rows.length) return fallback

  let peak = -Infinity
  for (const period of periods) {
    const inPeriod = rows.filter(
      (r) => r.finishedAt! >= period.start && r.finishedAt! <= period.end,
    )
    if (!inPeriod.length) continue
    const agg = aggregateRows(inPeriod)
    if (agg[0] && agg[0].rating > peak) peak = agg[0].rating
  }
  return peak === -Infinity ? fallback : peak
}
