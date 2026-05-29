import { HUB, PLAYERS, type PlayerRow } from './data/mock'

export type LeaderboardResult = { rows: PlayerRow[]; live: boolean }
export type SyncStatus = { matches: number; players: number; lastSync: string; live: boolean }

export type MapRow = {
  map: string
  matches: number
  avgKills: number
  avgAdr: number
  avgHsPct: number
  avgKd: number
}

export type Overview = {
  sourceName: string
  game: string
  matches: number
  players: number
  lastSync: string
  live: boolean
}

const API = '/api'

export async function fetchLeaderboard(opts?: { map?: string }): Promise<LeaderboardResult> {
  const map = opts?.map?.trim()
  try {
    const params = new URLSearchParams({ pageSize: '200', sort: 'rating', order: 'desc' })
    if (map) params.set('map', map)
    const res = await fetch(`${API}/leaderboard?${params.toString()}`)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const items: any[] = data.items ?? []
    if (!items.length) {
      // Если выбрана карта — это валидный пустой live-результат, мок не подставляем.
      if (map) return { rows: [], live: true }
      return { rows: PLAYERS, live: false }
    }
    const rows: PlayerRow[] = items.map((it) => ({
      id: it.playerId,
      rank: it.rank,
      nickname: it.nickname,
      country: it.country ?? '',
      avatar: it.avatar ?? '',
      matches: it.matches,
      wins: it.wins,
      winrate: it.winrate,
      kills: it.kills,
      deaths: it.deaths,
      assists: it.assists,
      kd: it.kd,
      kr: it.kr,
      adr: it.adr,
      hsPct: it.hsPct,
      mvps: it.mvps,
      rating: it.rating,
    }))
    return { rows, live: true }
  } catch {
    // При выбранной карте мок (не отфильтрованный по карте) подставлять некорректно.
    if (map) return { rows: [], live: false }
    return { rows: PLAYERS, live: false }
  }
}

export async function fetchMaps(): Promise<MapRow[]> {
  try {
    const res = await fetch(`${API}/maps`)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const items: any[] = data.items ?? []
    return items
      .filter((it) => it.map && String(it.map).trim().length > 0)
      .map((it) => ({
        map: it.map,
        matches: it.matches ?? 0,
        avgKills: it.avgKills ?? 0,
        avgAdr: it.avgAdr ?? 0,
        avgHsPct: it.avgHsPct ?? 0,
        avgKd: it.avgKd ?? 0,
      }))
  } catch {
    return []
  }
}

export async function fetchStatus(): Promise<SyncStatus> {
  try {
    const res = await fetch(`${API}/sync/status`)
    if (!res.ok) throw new Error(String(res.status))
    const d = await res.json()
    if (!d.players) return { matches: 0, players: 0, lastSync: '—', live: false }
    const ts = d.last?.finishedAt ? new Date(d.last.finishedAt).toLocaleString('ru-RU') : '—'
    return { matches: d.matches ?? 0, players: d.players ?? 0, lastSync: ts, live: true }
  } catch {
    return { matches: 0, players: 0, lastSync: '—', live: false }
  }
}

export async function fetchOverview(): Promise<Overview> {
  const fallback: Overview = {
    sourceName: HUB.name,
    game: HUB.game,
    matches: HUB.matches,
    players: HUB.players,
    lastSync: HUB.lastSync,
    live: false,
  }
  try {
    const [sourcesRes, statusRes] = await Promise.all([
      fetch(`${API}/sources`),
      fetch(`${API}/sync/status`),
    ])
    if (!sourcesRes.ok || !statusRes.ok) throw new Error('overview')

    const sources: any[] = await sourcesRes.json()
    const status: any = await statusRes.json()

    const first = Array.isArray(sources) ? sources[0] : null
    if (!first || !status?.players) throw new Error('empty')

    const lastSync = status.last?.finishedAt
      ? new Date(status.last.finishedAt).toLocaleString('ru-RU')
      : '—'

    return {
      sourceName: first.name ?? HUB.name,
      game: first.game ?? HUB.game,
      matches: status.matches ?? 0,
      players: status.players ?? 0,
      lastSync,
      live: true,
    }
  } catch {
    return fallback
  }
}
