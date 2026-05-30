import { prisma } from './db.js'
import { env } from './env.js'

/**
 * Пишет батч снапшотов рангов (один общий takenAt).
 * Ранг = позиция по rating desc среди игроков с matches >= env.leaderboardMinMatches.
 * Тай-брейк по playerId для стабильности.
 */
export async function writeRankSnapshot(): Promise<number> {
  const rows = await prisma.playerAggregate.findMany({
    where: { matches: { gte: env.leaderboardMinMatches } },
    select: { playerId: true, rating: true },
  })

  rows.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    return a.playerId.localeCompare(b.playerId)
  })

  if (!rows.length) return 0

  const takenAt = new Date()
  await prisma.rankSnapshot.createMany({
    data: rows.map((r, i) => ({
      playerId: r.playerId,
      rank: i + 1,
      rating: r.rating,
      takenAt,
    })),
  })
  return rows.length
}

/**
 * Сравнивает два последних батча снапшотов (по takenAt).
 * Возвращает playerId -> delta (prevRank - currentRank):
 *   >0 поднялся, <0 упал, 0 без изменений, null если в прошлом батче игрока не было.
 * Если есть только один батч (или нет вовсе) — все значения null.
 */
export async function getRankDeltas(): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()

  const batches = await prisma.rankSnapshot.findMany({
    distinct: ['takenAt'],
    orderBy: { takenAt: 'desc' },
    select: { takenAt: true },
    take: 2,
  })

  if (!batches.length) return result

  const currentAt = batches[0].takenAt
  const current = await prisma.rankSnapshot.findMany({
    where: { takenAt: currentAt },
    select: { playerId: true, rank: true },
  })

  if (batches.length < 2) {
    for (const r of current) result.set(r.playerId, null)
    return result
  }

  const prevAt = batches[1].takenAt
  const prev = await prisma.rankSnapshot.findMany({
    where: { takenAt: prevAt },
    select: { playerId: true, rank: true },
  })
  const prevRank = new Map(prev.map((p) => [p.playerId, p.rank]))

  for (const r of current) {
    const before = prevRank.get(r.playerId)
    result.set(r.playerId, before === undefined ? null : before - r.rank)
  }
  return result
}
