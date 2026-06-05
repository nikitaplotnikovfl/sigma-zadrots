import { prisma } from './db.js'
import { hltvRating } from './aggregate.js'

// ---- whitelist сортируемых колонок (тот же, что в server.ts) ----
type SortKey =
  | 'rating' | 'matches' | 'winrate' | 'kd' | 'kr' | 'adr'
  | 'hsPct' | 'kills' | 'deaths' | 'assists' | 'mvps'

export interface LeaderboardParams {
  sort: SortKey
  order: 'asc' | 'desc'
  q?: string
  minMatches: number
  page: number
  pageSize: number
}

export interface LeaderboardItem {
  rank: number
  playerId: string
  nickname: string
  avatar: string | null
  country: string | null
  matches: number
  wins: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  kd: number
  kr: number
  adr: number
  hsPct: number
  mvps: number
  rating: number
}

// Минимальная форма строки PlayerMatchStats + связанный игрок, нужная для агрегации.
export interface StatsRow {
  playerId: string
  won: boolean
  kills: number
  deaths: number
  assists: number
  kr: number
  adr: number
  headshots: number
  mvps: number
  rounds: number
  doubleKills: number
  tripleKills: number
  quadroKills: number
  pentaKills: number
  player: { nickname: string; avatar: string | null; country: string | null }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/**
 * Чистая агрегация строк PlayerMatchStats в строки лидерборда (без rank/пагинации).
 * Группирует по playerId и считает метрики так же, как recomputeAggregates в aggregate.ts.
 */
export function aggregateRows(rows: StatsRow[]): Omit<LeaderboardItem, 'rank'>[] {
  const byPlayer = new Map<string, StatsRow[]>()
  for (const r of rows) {
    const list = byPlayer.get(r.playerId) ?? []
    list.push(r)
    byPlayer.set(r.playerId, list)
  }

  const items: Omit<LeaderboardItem, 'rank'>[] = []
  for (const [playerId, list] of byPlayer) {
    const games = list.length
    const wins = list.filter((r) => r.won).length
    const winrate = games ? +((wins / games) * 100).toFixed(1) : 0
    const kills = sum(list.map((r) => r.kills))
    const deaths = sum(list.map((r) => r.deaths))
    const assists = sum(list.map((r) => r.assists))
    const headshots = sum(list.map((r) => r.headshots))
    const kd = deaths ? +(kills / deaths).toFixed(2) : kills
    const kr = +avg(list.map((r) => r.kr)).toFixed(2)
    const adr = +avg(list.map((r) => r.adr)).toFixed(1)
    const hsPct = kills ? +((headshots / kills) * 100).toFixed(1) : 0
    const p = list[0].player
    items.push({
      playerId,
      nickname: p.nickname,
      avatar: p.avatar,
      country: p.country,
      matches: games,
      wins,
      winrate,
      kills,
      deaths,
      assists,
      kd,
      kr,
      adr,
      hsPct,
      mvps: sum(list.map((r) => r.mvps)),
      rating: hltvRating(kills, deaths, sum(list.map((r) => r.rounds)), {
        double: sum(list.map((r) => r.doubleKills)),
        triple: sum(list.map((r) => r.tripleKills)),
        quadro: sum(list.map((r) => r.quadroKills)),
        penta: sum(list.map((r) => r.pentaKills)),
      }),
    })
  }
  return items
}

/**
 * Лидерборд, посчитанный на лету по одной карте (mapName=map).
 * Возвращает total (после фильтров) и items с rank относительно выбранной страницы.
 */
export async function leaderboardByMap(
  map: string,
  { sort, order, q, minMatches, page, pageSize }: LeaderboardParams,
): Promise<{ total: number; items: LeaderboardItem[] }> {
  const rows = await prisma.playerMatchStats.findMany({
    where: { mapName: map },
    include: { player: true },
  })

  let items = aggregateRows(rows)

  // фильтр по нику (без регистра) и минимальному числу матчей
  if (q) {
    const needle = q.toLowerCase()
    items = items.filter((it) => it.nickname.toLowerCase().includes(needle))
  }
  items = items.filter((it) => it.matches >= minMatches)

  // сортировка по выбранной колонке/направлению (стабильный тай-брейк по нику)
  const dir = order === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const diff = (a[sort] - b[sort]) * dir
    if (diff !== 0) return diff
    return a.nickname.localeCompare(b.nickname)
  })

  const total = items.length
  const start = (page - 1) * pageSize
  const paged = items.slice(start, start + pageSize)

  return {
    total,
    items: paged.map((it, i) => ({ rank: start + i + 1, ...it })),
  }
}
