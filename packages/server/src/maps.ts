import { prisma } from './db.js'

export interface MapOverview {
  map: string
  matches: number
  avgKills: number
  avgAdr: number
  avgHsPct: number
  avgKd: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export async function mapsOverview(): Promise<MapOverview[]> {
  const rows = await prisma.playerMatchStats.findMany()
  const byMap = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.mapName) continue
    const list = byMap.get(r.mapName) ?? []
    list.push(r)
    byMap.set(r.mapName, list)
  }

  const items: MapOverview[] = []
  for (const [map, list] of byMap) {
    items.push({
      map,
      matches: new Set(list.map((r) => r.matchId)).size,
      avgKills: +avg(list.map((r) => r.kills)).toFixed(1),
      avgAdr: +avg(list.map((r) => r.adr)).toFixed(1),
      avgHsPct: +avg(list.map((r) => r.hsPct)).toFixed(1),
      avgKd: +avg(list.map((r) => r.kd)).toFixed(2),
    })
  }

  items.sort((a, b) => b.matches - a.matches)
  return items
}
