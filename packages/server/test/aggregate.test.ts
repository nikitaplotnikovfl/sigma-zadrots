import { describe, it, expect } from 'vitest'
import { ratingV1 } from '../src/aggregate.js'

describe('ratingV1', () => {
  it('zero input -> zero rating', () => {
    expect(ratingV1(0, 0, 0, 0)).toBe(0)
  })

  it('deterministic value for an "average" player (kd=1, kr=0.7, adr=80, wr=50)', () => {
    // 0.4*1 + 0.3*(0.7/0.7) + 0.2*(80/80) + 0.1*(50/100)
    // = 0.4 + 0.3 + 0.2 + 0.05 = 0.95
    expect(ratingV1(1, 0.7, 80, 50)).toBe(0.95)
  })

  it('deterministic value for a strong player', () => {
    // 0.4*1.5 + 0.3*(0.9/0.7) + 0.2*(95/80) + 0.1*(70/100)
    const expected = +(0.4 * 1.5 + 0.3 * (0.9 / 0.7) + 0.2 * (95 / 80) + 0.1 * (70 / 100)).toFixed(3)
    expect(ratingV1(1.5, 0.9, 95, 70)).toBe(expected)
    expect(ratingV1(1.5, 0.9, 95, 70)).toBeCloseTo(1.293, 3)
  })

  it('result is rounded to 3 decimals', () => {
    const r = ratingV1(1.234567, 0.812345, 83.21, 53.7)
    expect(Number.isFinite(r)).toBe(true)
    // не более 3 знаков после запятой
    expect(r.toString()).toMatch(/^\d+(\.\d{1,3})?$/)
  })

  it('rating grows with K/D (all else fixed)', () => {
    const lo = ratingV1(0.8, 0.7, 80, 50)
    const hi = ratingV1(1.6, 0.7, 80, 50)
    expect(hi).toBeGreaterThan(lo)
  })

  it('rating grows with K/R (all else fixed)', () => {
    const lo = ratingV1(1, 0.6, 80, 50)
    const hi = ratingV1(1, 0.9, 80, 50)
    expect(hi).toBeGreaterThan(lo)
  })

  it('rating grows with ADR (all else fixed)', () => {
    const lo = ratingV1(1, 0.7, 60, 50)
    const hi = ratingV1(1, 0.7, 100, 50)
    expect(hi).toBeGreaterThan(lo)
  })

  it('rating grows with winrate (all else fixed)', () => {
    const lo = ratingV1(1, 0.7, 80, 30)
    const hi = ratingV1(1, 0.7, 80, 90)
    expect(hi).toBeGreaterThan(lo)
  })

  it('monotonic ordering of three players', () => {
    const weak = ratingV1(0.7, 0.55, 55, 30)
    const mid = ratingV1(1.0, 0.7, 78, 50)
    const top = ratingV1(1.5, 0.95, 100, 75)
    expect(weak).toBeLessThan(mid)
    expect(mid).toBeLessThan(top)
  })
})
