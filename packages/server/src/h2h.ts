import { prisma } from './db.js'

export interface H2HSide {
  kills: number
  deaths: number
  kd: number
  adr: number
  won: boolean
}

export interface H2HRow {
  matchId: string
  mapName: string | null
  finishedAt: Date | null
  sameTeam: boolean
  a: H2HSide
  b: H2HSide
}

export interface H2HResult {
  a: { id: string; nickname: string; avatar: string | null }
  b: { id: string; nickname: string; avatar: string | null }
  commonMatches: number
  record: { aWins: number; bWins: number }
  rows: H2HRow[]
}

export class NotFoundError extends Error {}

/**
 * Head-to-head двух игроков по совместным картам (matchId+mapNum, где сыграли оба).
 * record считается только по картам на РАЗНЫХ командах.
 * Бросает NotFoundError, если игрок не найден.
 */
export async function headToHead(aId: string, bId: string): Promise<H2HResult> {
  const [aPlayer, bPlayer] = await Promise.all([
    prisma.player.findUnique({ where: { id: aId }, select: { id: true, nickname: true, avatar: true } }),
    prisma.player.findUnique({ where: { id: bId }, select: { id: true, nickname: true, avatar: true } }),
  ])
  if (!aPlayer) throw new NotFoundError(`player ${aId} not found`)
  if (!bPlayer) throw new NotFoundError(`player ${bId} not found`)

  const [aRows, bRows] = await Promise.all([
    prisma.playerMatchStats.findMany({ where: { playerId: aId } }),
    prisma.playerMatchStats.findMany({ where: { playerId: bId } }),
  ])

  const bByKey = new Map(bRows.map((r) => [`${r.matchId}:${r.mapNum}`, r]))

  const rows: H2HRow[] = []
  let aWins = 0
  let bWins = 0

  for (const a of aRows) {
    const b = bByKey.get(`${a.matchId}:${a.mapNum}`)
    if (!b) continue
    const sameTeam = a.teamId != null && a.teamId === b.teamId
    if (!sameTeam) {
      if (a.won) aWins++
      else if (b.won) bWins++
    }
    rows.push({
      matchId: a.matchId,
      mapName: a.mapName,
      finishedAt: a.finishedAt,
      sameTeam,
      a: { kills: a.kills, deaths: a.deaths, kd: a.kd, adr: a.adr, won: a.won },
      b: { kills: b.kills, deaths: b.deaths, kd: b.kd, adr: b.adr, won: b.won },
    })
  }

  rows.sort((x, y) => {
    const tx = x.finishedAt ? x.finishedAt.getTime() : 0
    const ty = y.finishedAt ? y.finishedAt.getTime() : 0
    return ty - tx
  })

  return {
    a: aPlayer,
    b: bPlayer,
    commonMatches: rows.length,
    record: { aWins, bWins },
    rows,
  }
}
