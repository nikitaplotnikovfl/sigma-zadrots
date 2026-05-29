import { describe, it, expect } from 'vitest'
import { parseMatchRounds, num } from '../src/normalize.js'
import type { MatchStats } from '../src/faceit.js'
import fixture from './fixtures/match-stats.json' assert { type: 'json' }

const MATCH_ID = '1-aaaa-bbbb-cccc-dddd'
const FINISHED_AT = 1_700_000_000 // unix seconds

const stats = fixture as MatchStats

describe('num helper', () => {
  it('parses numeric strings', () => {
    expect(num({ Kills: '27' }, 'Kills')).toBe(27)
    expect(num({ ADR: '98.4' }, 'ADR')).toBe(98.4)
  })
  it('returns 0 for missing / non-numeric / undefined', () => {
    expect(num({}, 'Kills')).toBe(0)
    expect(num({ Kills: 'n/a' }, 'Kills')).toBe(0)
    expect(num(undefined, 'Kills')).toBe(0)
  })
})

describe('parseMatchRounds', () => {
  const { match, statsRows } = parseMatchRounds(MATCH_ID, stats.rounds, FINISHED_AT)

  it('produces one stats row per player', () => {
    const players = stats.rounds.flatMap((r) => r.teams.flatMap((t) => t.players))
    expect(statsRows).toHaveLength(players.length)
    expect(statsRows).toHaveLength(5)
  })

  it('match-level fields', () => {
    expect(match.status).toBe('FINISHED')
    expect(match.bestOf).toBe(1)
    expect(match.region).toBe('EU')
    expect(match.winnerTeamId).toBe('team-alpha')
    expect(match.finishedAt).toEqual(new Date(FINISHED_AT * 1000))
  })

  it('teams summary is SERIES score (maps won), not round score', () => {
    const alpha = match.teams.find((t) => t.teamId === 'team-alpha')!
    const bravo = match.teams.find((t) => t.teamId === 'team-bravo')!
    // BO1 → серия 1:0 (карт выиграно), а не Final Score 13/9
    expect(alpha).toMatchObject({ name: 'Alpha', score: 1, isWinner: true })
    expect(bravo).toMatchObject({ name: 'Bravo', score: 0, isWinner: false })
  })

  it('maps: per-map structure with round scores and per-map winner', () => {
    expect(match.maps).toHaveLength(1)
    const map = match.maps[0]
    expect(map.mapNum).toBe(1)
    expect(map.mapName).toBe('de_dust2')
    const alpha = map.teams.find((t) => t.teamId === 'team-alpha')!
    const bravo = map.teams.find((t) => t.teamId === 'team-bravo')!
    // score карты = Final Score (раунды); isWinner = победитель ЭТОЙ карты
    expect(alpha).toMatchObject({ name: 'Alpha', score: 13, isWinner: true })
    expect(bravo).toMatchObject({ name: 'Bravo', score: 9, isWinner: false })
  })

  it('id format `${matchId}:${mapNum}:${playerId}`', () => {
    const row = statsRows.find((r) => r.playerId === 'p-001')!
    expect(row.id).toBe(`${MATCH_ID}:1:p-001`)
    for (const r of statsRows) {
      expect(r.id).toBe(`${MATCH_ID}:${r.mapNum}:${r.playerId}`)
    }
  })

  it('parses FACEIT stat keys for a player (s1mple)', () => {
    const row = statsRows.find((r) => r.playerId === 'p-001')!
    expect(row).toMatchObject({
      nickname: 's1mple',
      mapNum: 1,
      mapName: 'de_dust2',
      teamId: 'team-alpha',
      teamName: 'Alpha',
      kills: 27,
      deaths: 14,
      assists: 5,
      kd: 1.93,
      kr: 1.23,
      adr: 98.4,
      headshots: 13,
      hsPct: 48,
      mvps: 6,
      tripleKills: 2,
      quadroKills: 1,
      pentaKills: 0,
    })
  })

  it('won reflects per-map result via "Team Win" / round Winner', () => {
    const alphaRows = statsRows.filter((r) => r.teamId === 'team-alpha')
    const bravoRows = statsRows.filter((r) => r.teamId === 'team-bravo')
    expect(alphaRows.every((r) => r.won)).toBe(true)
    expect(bravoRows.every((r) => r.won)).toBe(false)
  })

  it('parses losing-team player (ZywOo)', () => {
    const row = statsRows.find((r) => r.playerId === 'p-004')!
    expect(row).toMatchObject({
      nickname: 'ZywOo',
      teamId: 'team-bravo',
      kills: 24,
      deaths: 18,
      adr: 89.7,
      hsPct: 46,
      won: false,
    })
  })

  it('all rows carry mapName and finishedAt', () => {
    for (const r of statsRows) {
      expect(r.mapName).toBe('de_dust2')
      expect(r.finishedAt).toEqual(new Date(FINISHED_AT * 1000))
    }
  })

  it('empty rounds -> empty result', () => {
    const res = parseMatchRounds(MATCH_ID, [], undefined)
    expect(res.statsRows).toHaveLength(0)
    expect(res.match.teams).toHaveLength(0)
    expect(res.match.maps).toHaveLength(0)
    expect(res.match.finishedAt).toBeNull()
  })
})
