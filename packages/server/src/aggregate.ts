import { prisma } from './db.js'

/**
 * Рейтинг v1 (приближение, документировано в SPEC.md):
 *   rating = 0.4·K/D + 0.3·(K/R ÷ 0.7) + 0.2·(ADR ÷ 80) + 0.1·winrate
 * Центрируется около ~1.0 для среднего игрока. Легко заменить на HLTV-подобный,
 * когда появятся раунды/KAST.
 */
export function ratingV1(kd: number, kr: number, adr: number, winrate: number): number {
  return +(0.4 * kd + 0.3 * (kr / 0.7) + 0.2 * (adr / 80) + 0.1 * (winrate / 100)).toFixed(3)
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export async function recomputeAggregates(): Promise<number> {
  const rows = await prisma.playerMatchStats.findMany()
  const byPlayer = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byPlayer.get(r.playerId) ?? []
    list.push(r)
    byPlayer.set(r.playerId, list)
  }

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
    const data = {
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
      doubleKills: sum(list.map((r) => r.doubleKills)),
      tripleKills: sum(list.map((r) => r.tripleKills)),
      quadroKills: sum(list.map((r) => r.quadroKills)),
      pentaKills: sum(list.map((r) => r.pentaKills)),
      rounds: sum(list.map((r) => r.rounds)),
      rating: ratingV1(kd, kr, adr, winrate),
    }
    await prisma.playerAggregate.upsert({
      where: { playerId },
      create: { playerId, ...data },
      update: data,
    })
  }

  // подчистить агрегаты игроков без статистики
  const ids = [...byPlayer.keys()]
  await prisma.playerAggregate.deleteMany({
    where: ids.length ? { playerId: { notIn: ids } } : {},
  })
  return byPlayer.size
}
