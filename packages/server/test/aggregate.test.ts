import { describe, it, expect } from 'vitest'
import { hltvRating, type MultiKills } from '../src/aggregate.js'

const NO_MK: MultiKills = { double: 0, triple: 0, quadro: 0, penta: 0 }

describe('hltvRating', () => {
  it('zero rounds -> zero rating (нет данных)', () => {
    expect(hltvRating(0, 0, 0, NO_MK)).toBe(0)
  })

  it('средний игрок около ~0.8–1.0 (KPR≈0.7, выживаемость≈0.3, без мультикиллов)', () => {
    // 20 раундов: kills=14 (KPR 0.7), deaths=14 (SPR 0.3). Без мультикиллов RMK ниже среднего,
    // поэтому рейтинг чуть ниже 1.0 — это корректное поведение HLTV 1.0.
    const r = hltvRating(14, 14, 20, NO_MK)
    expect(r).toBeGreaterThan(0.7)
    expect(r).toBeLessThan(1.0)
  })

  it('детерминированное значение по формуле HLTV 1.0', () => {
    const kills = 26,
      deaths = 17,
      rounds = 30
    const mk: MultiKills = { double: 7, triple: 2, quadro: 0, penta: 0 }
    const killRating = kills / rounds / 0.679
    const survival = (rounds - deaths) / rounds / 0.317
    const oneK = kills - 2 * mk.double - 3 * mk.triple
    const rmk = (oneK + 4 * mk.double + 9 * mk.triple) / rounds / 1.277
    const expected = +((killRating + 0.7 * survival + rmk) / 2.7).toFixed(2)
    expect(hltvRating(kills, deaths, rounds, mk)).toBe(expected)
  })

  it('округление до 2 знаков', () => {
    const r = hltvRating(19, 14, 27, { double: 3, triple: 1, quadro: 0, penta: 0 })
    expect(r.toString()).toMatch(/^\d+(\.\d{1,2})?$/)
  })

  it('рейтинг растёт с числом киллов (всё прочее фиксировано)', () => {
    const lo = hltvRating(12, 15, 24, NO_MK)
    const hi = hltvRating(20, 15, 24, NO_MK)
    expect(hi).toBeGreaterThan(lo)
  })

  it('рейтинг растёт с выживаемостью (меньше смертей)', () => {
    const lo = hltvRating(16, 20, 24, NO_MK)
    const hi = hltvRating(16, 10, 24, NO_MK)
    expect(hi).toBeGreaterThan(lo)
  })

  it('мультикиллы поднимают рейтинг при тех же киллах', () => {
    // одинаковые kills, но у одного они через 2K/3K (выше RMK-вес)
    const flat = hltvRating(16, 14, 24, NO_MK)
    const multi = hltvRating(16, 14, 24, { double: 4, triple: 2, quadro: 0, penta: 0 })
    expect(multi).toBeGreaterThan(flat)
  })

  it('монотонный порядок трёх игроков', () => {
    const weak = hltvRating(10, 18, 24, NO_MK)
    const mid = hltvRating(16, 14, 24, { double: 2, triple: 0, quadro: 0, penta: 0 })
    const top = hltvRating(24, 9, 24, { double: 5, triple: 2, quadro: 1, penta: 0 })
    expect(weak).toBeLessThan(mid)
    expect(mid).toBeLessThan(top)
  })
})
