import { describe, it, expect } from 'vitest'
import { playerStreak } from '../src/analytics.js'

describe('playerStreak', () => {
  it('returns null for no rows', () => {
    expect(playerStreak([])).toBeNull()
  })

  it('counts a current win streak from the newest row', () => {
    const rows = [{ won: true }, { won: true }, { won: false }, { won: true }]
    expect(playerStreak(rows)).toEqual({ type: 'W', count: 2 })
  })

  it('counts a current loss streak', () => {
    const rows = [{ won: false }, { won: false }, { won: false }, { won: true }]
    expect(playerStreak(rows)).toEqual({ type: 'L', count: 3 })
  })

  it('handles a single row', () => {
    expect(playerStreak([{ won: true }])).toEqual({ type: 'W', count: 1 })
    expect(playerStreak([{ won: false }])).toEqual({ type: 'L', count: 1 })
  })

  it('handles an all-win streak', () => {
    expect(playerStreak([{ won: true }, { won: true }])).toEqual({ type: 'W', count: 2 })
  })
})
