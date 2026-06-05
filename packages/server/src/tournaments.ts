import { prisma } from './db.js'
import { env } from './env.js'
import { aggregateRows, type StatsRow, type LeaderboardItem, type LeaderboardParams } from './statsQuery.js'

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

export type StatDelta = { rating: number; kd: number; adr: number; winrate: number }

/**
 * Дельты ключевых метрик за ПОСЛЕДНИЙ турнир относительно ПРЕДЫДУЩЕГО:
 *   delta = (метрика игрока за последний турнир) − (та же метрика за предыдущий турнир).
 * Считается только для игроков, у кого есть матчи в ОБОИХ турнирах (иначе сравнивать не с чем → нет дельты).
 * Возвращает Map playerId -> StatDelta (rating/kd/adr/winrate).
 */
export async function getTournamentStatDeltas(): Promise<Map<string, StatDelta>> {
  const periods = await detectTournaments()
  const out = new Map<string, StatDelta>()
  if (periods.length < 2) return out

  const last = periods[periods.length - 1]
  const prev = periods[periods.length - 2]

  const load = async (p: Tournament) =>
    (await prisma.playerMatchStats.findMany({
      where: { finishedAt: { gte: p.start, lte: p.end } },
      select: STAT_SELECT,
    })) as unknown as StatsRow[]

  const [lastAgg, prevAgg] = await Promise.all([
    load(last).then(aggregateRows),
    load(prev).then(aggregateRows),
  ])
  const prevByPlayer = new Map(prevAgg.map((a) => [a.playerId, a]))

  for (const cur of lastAgg) {
    const before = prevByPlayer.get(cur.playerId)
    if (!before) continue // игрок не играл в предыдущем турнире — дельту не показываем
    out.set(cur.playerId, {
      rating: +(cur.rating - before.rating).toFixed(2),
      kd: +(cur.kd - before.kd).toFixed(2),
      adr: +(cur.adr - before.adr).toFixed(1),
      winrate: +(cur.winrate - before.winrate).toFixed(1),
    })
  }
  return out
}

/** Список турниров для UI: индекс (0 — самый ранний), даты, число матчей; свежие первыми. */
export async function listTournaments(): Promise<
  { index: number; start: Date; end: Date; matches: number }[]
> {
  const periods = await detectTournaments()
  return periods
    .map((p, index) => ({ index, start: p.start, end: p.end, matches: p.matches }))
    .reverse()
}

/**
 * Лидерборд за один турнир (по индексу из detectTournaments) — агрегаты считаются на лету
 * по матчам, попавшим в окно [start, end] периода. Минимальный порог матчей здесь не применяется
 * (за один турнир игр немного), но q/minMatches/сортировка/пагинация работают как обычно.
 */
export async function leaderboardByTournament(
  index: number,
  { sort, order, q, minMatches, page, pageSize }: LeaderboardParams,
): Promise<{ total: number; items: LeaderboardItem[]; period: { start: Date; end: Date } } | null> {
  const periods = await detectTournaments()
  const period = periods[index]
  if (!period) return null

  const rows = (await prisma.playerMatchStats.findMany({
    where: { finishedAt: { gte: period.start, lte: period.end } },
    select: STAT_SELECT,
  })) as unknown as StatsRow[]

  let items = aggregateRows(rows)
  if (q) {
    const needle = q.toLowerCase()
    items = items.filter((it) => it.nickname.toLowerCase().includes(needle))
  }
  if (minMatches > 0) items = items.filter((it) => it.matches >= minMatches)

  const dir = order === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const diff = (a[sort] - b[sort]) * dir
    if (diff !== 0) return diff
    return a.nickname.localeCompare(b.nickname)
  })

  const total = items.length
  const start = (page - 1) * pageSize
  const paged = items.slice(start, start + pageSize).map((it, i) => ({ rank: start + i + 1, ...it }))
  return { total, items: paged, period: { start: period.start, end: period.end } }
}
