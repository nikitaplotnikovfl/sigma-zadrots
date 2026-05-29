import { env } from './env.js'
import { logger } from './logger.js'

const BASE = 'https://open.faceit.com/data/v4'
const log = logger.child({ mod: 'faceit' })

// Простой последовательный троттлинг + backoff на 429/5xx.
let lastCall = 0

async function throttle() {
  const now = Date.now()
  const wait = env.minIntervalMs - (now - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

async function get<T>(path: string, attempt = 0): Promise<T> {
  await throttle()
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${env.faceitApiKey}`, Accept: 'application/json' },
  })

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) {
      log.error({ status: res.status, path, attempt }, 'faceit giving up after retries')
      throw new Error(`FACEIT ${res.status} после ${attempt} попыток: ${path}`)
    }
    const delay = Math.min(15000, 800 * 2 ** attempt)
    log.warn({ status: res.status, path, attempt, delay }, 'faceit retry (rate limit / server error)')
    await new Promise((r) => setTimeout(r, delay))
    return get<T>(path, attempt + 1)
  }
  if (!res.ok) {
    const body = await res.text()
    log.error({ status: res.status, path, body: body.slice(0, 200) }, 'faceit request failed')
    throw new Error(`FACEIT ${res.status}: ${path} — ${body}`)
  }
  log.debug({ path }, 'faceit ok')
  return (await res.json()) as T
}

// ---- Типы ответов (только нужные поля) ----

export type HubInfo = { hub_id: string; name: string; game_id: string }

export type HubMatchItem = {
  match_id: string
  status: string
  started_at?: number
  finished_at?: number
  competition_name?: string
}

export type MatchStatsPlayer = {
  player_id: string
  nickname: string
  player_stats: Record<string, string>
}

export type MatchStatsTeam = {
  team_id: string
  team_stats: Record<string, string>
  players: MatchStatsPlayer[]
}

export type MatchStatsRound = {
  match_round: string
  round_stats: Record<string, string>
  teams: MatchStatsTeam[]
}

export type MatchStats = { rounds: MatchStatsRound[] }

export type PlayerInfo = {
  player_id: string
  nickname: string
  avatar?: string
  country?: string
  faceit_url?: string
}

// ---- Методы ----

export const faceit = {
  getHub: (hubId: string) => get<HubInfo>(`/hubs/${hubId}`),

  getHubMatches: (hubId: string, offset: number, limit: number) =>
    get<{ items: HubMatchItem[] }>(
      `/hubs/${hubId}/matches?type=past&offset=${offset}&limit=${limit}`,
    ),

  getMatchStats: (matchId: string) => get<MatchStats>(`/matches/${matchId}/stats`),

  getPlayer: (playerId: string) => get<PlayerInfo>(`/players/${playerId}`),
}
