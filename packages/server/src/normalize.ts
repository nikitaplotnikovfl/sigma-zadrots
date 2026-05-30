import type { MatchStatsRound } from './faceit.js'

/** Безопасный парс числового значения из объекта статистики FACEIT (значения приходят строками). */
export const num = (s: Record<string, string> | undefined, k: string): number => {
  const v = Number(s?.[k])
  return Number.isFinite(v) ? v : 0
}

/** Поля для записи в Match (без sourceId — он добавляется на стороне ingest). */
export type ParsedMatch = {
  region?: string
  status: string
  bestOf: number
  finishedAt: Date | null
  winnerTeamId?: string
  /** СЕРИЯ: [{teamId,name,score,isWinner}] — score = число выигранных карт; сериализуется в Match.teamsJson */
  teams: { teamId: string; name: string; score: number; isWinner: boolean }[]
  /** По-картовая структура — сериализуется в Match.mapsJson */
  maps: {
    mapNum: number
    mapName: string
    teams: { teamId: string; name: string; score: number; isWinner: boolean }[]
  }[]
}

/** Строка статистики игрока за карту матча (соответствует модели PlayerMatchStats). */
export type ParsedStatsRow = {
  id: string
  matchId: string
  playerId: string
  nickname: string
  mapNum: number
  mapName?: string
  teamId: string
  teamName: string
  won: boolean
  kills: number
  deaths: number
  assists: number
  kd: number
  kr: number
  adr: number
  headshots: number
  hsPct: number
  mvps: number
  doubleKills: number
  tripleKills: number
  quadroKills: number
  pentaKills: number
  rounds: number
  entryCount: number
  entryWins: number
  firstKills: number
  clutchKills: number
  clutch1v1Count: number
  clutch1v1Wins: number
  clutch1v2Count: number
  clutch1v2Wins: number
  finishedAt: Date | null
}

export type ParseMatchResult = {
  match: ParsedMatch
  statsRows: ParsedStatsRow[]
}

/**
 * Чистая нормализация ответа FACEIT /matches/{id}/stats.
 * Без обращений к prisma/faceit — детерминированно превращает rounds в поля Match и строки PlayerMatchStats.
 *
 * - winnerTeamId определяется как команда, выигравшая большинство карт (round_stats['Winner']).
 * - match.teams — СЕРИЯ: score = число выигранных карт, isWinner = победитель серии.
 * - match.maps — по-картовая структура: score = счёт карты в раундах, isWinner = победитель ЭТОЙ карты.
 * - won у строки игрока: победа на ЭТОЙ карте (team_stats['Team Win'] === 1 ЛИБО team_id === round_stats['Winner'] этого раунда).
 * - id строки: `${matchId}:${mapNum}:${playerId}`.
 */
export function parseMatchRounds(
  matchId: string,
  rounds: MatchStatsRound[],
  finishedAt: number | undefined,
): ParseMatchResult {
  const finished = finishedAt ? new Date(finishedAt * 1000) : null

  if (!rounds.length) {
    return {
      match: { status: 'FINISHED', bestOf: 0, finishedAt: finished, teams: [], maps: [] },
      statsRows: [],
    }
  }

  const first = rounds[0]

  // По-картовая структура: победитель карты — по 'Team Win'/round Winner ЭТОГО раунда (не серии).
  const maps = rounds.map((r, idx) => {
    const winner = r.round_stats?.['Winner']
    return {
      mapNum: Number(r.match_round) || idx + 1,
      mapName: r.round_stats?.['Map'] ?? '',
      teams: r.teams.map((t) => ({
        teamId: t.team_id,
        name: t.team_stats?.['Team'] ?? '',
        score: num(t.team_stats, 'Final Score'),
        isWinner: num(t.team_stats, 'Team Win') === 1 || t.team_id === winner,
      })),
    }
  })

  // СЕРИЯ: score = число выигранных карт; победитель серии — по большинству карт.
  const wins = new Map<string, number>()
  for (const m of maps) {
    for (const t of m.teams) {
      if (!wins.has(t.teamId)) wins.set(t.teamId, 0)
      if (t.isWinner) wins.set(t.teamId, (wins.get(t.teamId) ?? 0) + 1)
    }
  }
  const winnerTeamId = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  const teams = first.teams.map((t) => ({
    teamId: t.team_id,
    name: t.team_stats?.['Team'] ?? '',
    score: wins.get(t.team_id) ?? 0,
    isWinner: t.team_id === winnerTeamId,
  }))

  const match: ParsedMatch = {
    region: first.round_stats?.['Region'],
    status: 'FINISHED',
    bestOf: rounds.length,
    finishedAt: finished,
    winnerTeamId,
    teams,
    maps,
  }

  const statsRows: ParsedStatsRow[] = []
  for (const r of rounds) {
    const mapNum = Number(r.match_round) || 1
    const mapName = r.round_stats?.['Map']
    const mapWinner = r.round_stats?.['Winner']
    const mapRounds = r.teams.reduce((acc, t) => acc + num(t.team_stats, 'Final Score'), 0)
    for (const team of r.teams) {
      const teamName = team.team_stats?.['Team'] ?? ''
      const teamWon = num(team.team_stats, 'Team Win') === 1 || team.team_id === mapWinner
      for (const p of team.players) {
        const s = p.player_stats
        statsRows.push({
          id: `${matchId}:${mapNum}:${p.player_id}`,
          matchId,
          playerId: p.player_id,
          nickname: p.nickname,
          mapNum,
          mapName,
          teamId: team.team_id,
          teamName,
          won: teamWon,
          kills: num(s, 'Kills'),
          deaths: num(s, 'Deaths'),
          assists: num(s, 'Assists'),
          kd: num(s, 'K/D Ratio'),
          kr: num(s, 'K/R Ratio'),
          adr: num(s, 'ADR') || num(s, 'Average Damage per Round'),
          headshots: num(s, 'Headshots'),
          hsPct: num(s, 'Headshots %'),
          mvps: num(s, 'MVPs'),
          doubleKills: num(s, 'Double Kills'),
          tripleKills: num(s, 'Triple Kills'),
          quadroKills: num(s, 'Quadro Kills'),
          pentaKills: num(s, 'Penta Kills'),
          rounds: mapRounds,
          entryCount: num(s, 'Entry Count'),
          entryWins: num(s, 'Entry Wins'),
          firstKills: num(s, 'First Kills'),
          clutchKills: num(s, 'Clutch Kills'),
          clutch1v1Count: num(s, '1v1Count'),
          clutch1v1Wins: num(s, '1v1Wins'),
          clutch1v2Count: num(s, '1v2Count'),
          clutch1v2Wins: num(s, '1v2Wins'),
          finishedAt: finished,
        })
      }
    }
  }

  return { match, statsRows }
}
