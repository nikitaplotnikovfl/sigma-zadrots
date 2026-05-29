import { describe, it, expect } from 'vitest'
import { aggregateRows, type StatsRow } from '../src/statsQuery.js'
import { ratingV1 } from '../src/aggregate.js'

const mkPlayer = (nickname: string) => ({ nickname, avatar: null, country: null })

const row = (over: Partial<StatsRow> & Pick<StatsRow, 'playerId' | 'player'>): StatsRow => ({
  won: false,
  kills: 0,
  deaths: 0,
  assists: 0,
  kr: 0,
  adr: 0,
  headshots: 0,
  mvps: 0,
  ...over,
})

describe('aggregateRows', () => {
  it('groups by player and sums kills/deaths/assists/mvps', () => {
    const rows: StatsRow[] = [
      row({ playerId: 'a', player: mkPlayer('Alice'), kills: 20, deaths: 10, assists: 5, mvps: 2, headshots: 10 }),
      row({ playerId: 'a', player: mkPlayer('Alice'), kills: 10, deaths: 10, assists: 3, mvps: 1, headshots: 4 }),
    ]
    const [a] = aggregateRows(rows)
    expect(a.matches).toBe(2)
    expect(a.kills).toBe(30)
    expect(a.deaths).toBe(20)
    expect(a.assists).toBe(8)
    expect(a.mvps).toBe(3)
  })

  it('computes kd, winrate, kr/adr averages, hsPct and rating', () => {
    const rows: StatsRow[] = [
      row({ playerId: 'a', player: mkPlayer('Alice'), won: true, kills: 20, deaths: 10, kr: 0.8, adr: 90, headshots: 10 }),
      row({ playerId: 'a', player: mkPlayer('Alice'), won: false, kills: 10, deaths: 10, kr: 0.6, adr: 70, headshots: 5 }),
    ]
    const [a] = aggregateRows(rows)
    expect(a.kd).toBe(1.5) // 30/20
    expect(a.winrate).toBe(50) // 1 win / 2
    expect(a.kr).toBe(0.7) // avg(0.8,0.6)
    expect(a.adr).toBe(80) // avg(90,70)
    expect(a.hsPct).toBe(50) // 15/30*100
    expect(a.rating).toBe(ratingV1(1.5, 0.7, 80, 50))
  })

  it('handles zero deaths (kd=kills) and zero kills (hsPct=0)', () => {
    const rows: StatsRow[] = [
      row({ playerId: 'z', player: mkPlayer('Zero'), kills: 7, deaths: 0, headshots: 0 }),
    ]
    const [z] = aggregateRows(rows)
    expect(z.kd).toBe(7)
    expect(z.hsPct).toBe(0)
  })

  it('produces one item per distinct player', () => {
    const rows: StatsRow[] = [
      row({ playerId: 'a', player: mkPlayer('Alice'), kills: 30, deaths: 10 }),
      row({ playerId: 'b', player: mkPlayer('Bob'), kills: 10, deaths: 20 }),
      row({ playerId: 'c', player: mkPlayer('Carol'), kills: 20, deaths: 20 }),
    ]
    const items = aggregateRows(rows)
    expect(items.map((i) => i.playerId).sort()).toEqual(['a', 'b', 'c'])

    // вручную отсортируем по rating desc и проверим порядок
    const byRating = [...items].sort((x, y) => y.rating - x.rating).map((i) => i.playerId)
    expect(byRating[0]).toBe('a') // самый высокий kd -> самый высокий rating
    expect(byRating[byRating.length - 1]).toBe('b') // самый низкий kd
  })
})
