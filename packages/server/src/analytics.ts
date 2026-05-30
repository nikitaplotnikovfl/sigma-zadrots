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

// ---- Пиковый рейтинг ----
export async function peakRating(playerId: string, fallback: number): Promise<number> {
  const top = await prisma.rankSnapshot.findFirst({
    where: { playerId },
    orderBy: { rating: 'desc' },
    select: { rating: true },
  })
  return top ? Math.max(top.rating, fallback) : fallback
}
