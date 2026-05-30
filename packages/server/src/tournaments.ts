import { prisma } from './db.js'
import { env } from './env.js'
import { aggregateRows, type StatsRow } from './statsQuery.js'

export type Tournament = { start: Date; end: Date; matches: number }

/**
 * Турниры определяются как кластеры матчей по дате finishedAt: новый турнир начинается,
 * если разрыв с предыдущим матчем больше env.tournamentGapDays (по умолчанию 14 дней).
 * Это надёжно разделяет ежемесячные турниры (внутри — дни, между — ~месяц).
 */
export async function detectTournaments(gapDays = env.tournamentGapDays): Promise<Tournament[]> {
  const ms = await prisma.match.findMany({
    where: { finishedAt: { not: null } },
    select: { finishedAt: true },
    orderBy: { finishedAt: 'asc' },
  })
  const gapMs = gapDays * 86_400_000
  const periods: Tournament[] = []
  for (const m of ms) {
    const t = m.finishedAt as Date
    const cur = periods[periods.length - 1]
    if (cur && t.getTime() - cur.end.getTime() <= gapMs) {
      cur.end = t
      cur.matches++
    } else {
      periods.push({ start: t, end: t, matches: 1 })
    }
  }
  return periods
}

export type TournamentMovement = {
  deltas: Map<string, number | null>
  last: Tournament | null
  prev: Tournament | null
}

const STAT_SELECT = {
  playerId: true,
  kills: true,
  deaths: true,
  assists: true,
  kr: true,
  adr: true,
  headshots: true,
  mvps: true,
  won: true,
  player: { select: { nickname: true, avatar: true, country: true } },
} as const

/**
 * Движение мест между двумя последними турнирами:
 *   delta = (ранг по состоянию ПОСЛЕ предыдущего турнира) − (текущий ранг).
 * >0 — поднялся, <0 — упал, 0 — без изменений, null — игрок не участвовал в прошлых турнирах (новичок).
 * Ранги считаются среди игроков текущего лидерборда (matches >= порог), по rating desc.
 */
export async function getTournamentRankDeltas(): Promise<TournamentMovement> {
  const periods = await detectTournaments()
  const pop = await prisma.playerAggregate.findMany({
    where: { matches: { gte: env.leaderboardMinMatches } },
    select: { playerId: true, rating: true },
  })

  if (periods.length < 2) {
    return {
      deltas: new Map(pop.map((p) => [p.playerId, null])),
      last: periods[periods.length - 1] ?? null,
      prev: null,
    }
  }

  const last = periods[periods.length - 1]
  const prev = periods[periods.length - 2]
  const cutoff = last.start // всё, что строго раньше последнего турнира — «прошлое»

  const popIds = pop.map((p) => p.playerId)
  const preRows = (await prisma.playerMatchStats.findMany({
    where: { finishedAt: { lt: cutoff }, playerId: { in: popIds } },
    select: STAT_SELECT,
  })) as unknown as StatsRow[]
  const prevAgg = aggregateRows(preRows)
  const prevRating = new Map(prevAgg.map((a) => [a.playerId, a.rating]))

  // текущие ранги по rating
  const byCurrent = [...pop].sort(
    (a, b) => b.rating - a.rating || a.playerId.localeCompare(b.playerId),
  )
  const currentRank = new Map(byCurrent.map((p, i) => [p.playerId, i + 1]))

  // прошлые ранги: новички (без прошлой статы) уходят вниз
  const byPrev = [...pop].sort((a, b) => {
    const ra = prevRating.has(a.playerId) ? (prevRating.get(a.playerId) as number) : -Infinity
    const rb = prevRating.has(b.playerId) ? (prevRating.get(b.playerId) as number) : -Infinity
    return rb - ra || a.playerId.localeCompare(b.playerId)
  })
  const previousRank = new Map(byPrev.map((p, i) => [p.playerId, i + 1]))

  const deltas = new Map<string, number | null>()
  for (const p of pop) {
    if (prevRating.has(p.playerId)) {
      deltas.set(
        p.playerId,
        (previousRank.get(p.playerId) as number) - (currentRank.get(p.playerId) as number),
      )
    } else {
      deltas.set(p.playerId, null)
    }
  }
  return { deltas, last, prev }
}
