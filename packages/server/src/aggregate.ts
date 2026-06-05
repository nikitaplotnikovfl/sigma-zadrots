import { prisma } from './db.js'

// Константы HLTV 1.0 (средние по большой выборке матчей) — те же, что использует индустрия.
const AVG_KPR = 0.679 // средние киллы за раунд
const AVG_SPR = 0.317 // средняя выживаемость за раунд (не умер)
const AVG_RMK = 1.277 // средний RoundsWithMultipleKills-вес

export type MultiKills = { double: number; triple: number; quadro: number; penta: number }

/**
 * HLTV 1.0 Rating — индустриальный стандарт, тот же, что показывают сайты аналитики CS.
 *   KillRating = (Kills/Rounds) / 0.679
 *   Survival   = ((Rounds−Deaths)/Rounds) / 0.317
 *   RoundsWMK  = (1·1K + 4·2K + 9·3K + 16·4K + 25·5K) / Rounds / 1.277
 *   Rating     = (KillRating + 0.7·Survival + RoundsWMK) / 2.7
 * 1K (раунды ровно с 1 killом) восстанавливаем из общего числа киллов и мультикиллов.
 */
export function hltvRating(
  kills: number,
  deaths: number,
  rounds: number,
  mk: MultiKills,
): number {
  if (!rounds) return 0
  const killRating = kills / rounds / AVG_KPR
  const survival = (rounds - deaths) / rounds / AVG_SPR
  const oneK = Math.max(0, kills - 2 * mk.double - 3 * mk.triple - 4 * mk.quadro - 5 * mk.penta)
  const rmk =
    (oneK + 4 * mk.double + 9 * mk.triple + 16 * mk.quadro + 25 * mk.penta) / rounds / AVG_RMK
  return +((killRating + 0.7 * survival + rmk) / 2.7).toFixed(2)
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
      entryCount: sum(list.map((r) => r.entryCount)),
      entryWins: sum(list.map((r) => r.entryWins)),
      firstKills: sum(list.map((r) => r.firstKills)),
      clutchKills: sum(list.map((r) => r.clutchKills)),
      clutch1v1Count: sum(list.map((r) => r.clutch1v1Count)),
      clutch1v1Wins: sum(list.map((r) => r.clutch1v1Wins)),
      clutch1v2Count: sum(list.map((r) => r.clutch1v2Count)),
      clutch1v2Wins: sum(list.map((r) => r.clutch1v2Wins)),
      rating: hltvRating(kills, deaths, sum(list.map((r) => r.rounds)), {
        double: sum(list.map((r) => r.doubleKills)),
        triple: sum(list.map((r) => r.tripleKills)),
        quadro: sum(list.map((r) => r.quadroKills)),
        penta: sum(list.map((r) => r.pentaKills)),
      }),
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
