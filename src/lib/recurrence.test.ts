import { describe, expect, it } from 'vitest'
import { addDays, addMonthsToDate } from './dates'
import { detectRecurring, type RecurrenceInput } from './recurrence'

let seq = 0
function tx(date: string, amount: number, merchant = 'Netflix', currency: 'TRY' | 'USD' = 'TRY'): RecurrenceInput {
  seq++
  return {
    id: `t${seq}`,
    date,
    amount,
    merchant,
    merchantKey: merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    currency,
    categoryId: 'subscriptions',
    accountId: 'card',
  }
}

function monthly(start: string, count: number, amount: number, merchant?: string): RecurrenceInput[] {
  return Array.from({ length: count }, (_, i) => tx(addMonthsToDate(start, i), amount, merchant))
}

/** Deterministic pseudo-random sequence for fixtures. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

describe('detectRecurring', () => {
  it('detects a monthly subscription and projects the next charge', () => {
    const series = detectRecurring(monthly('2026-01-15', 10, -229.99), '2026-10-20')
    expect(series).toHaveLength(1)
    const [s] = series
    expect(s).toMatchObject({
      merchant: 'Netflix',
      period: 'monthly',
      averageAmount: 229.99,
      annualCost: 2759.88,
      occurrences: 10,
      lastDate: '2026-10-15',
      nextDate: '2026-11-15',
      status: 'active',
    })
    expect(s?.confidence).toBeGreaterThan(0.85)
  })

  it('tolerates billing dates moving a few days (weekends, bank holidays)', () => {
    const dates = ['2026-01-01', '2026-02-02', '2026-03-01', '2026-04-03', '2026-05-01', '2026-06-01']
    const [s] = detectRecurring(dates.map((d) => tx(d, -99.99, 'Spotify')), '2026-06-10')
    expect(s?.period).toBe('monthly')
    expect(s?.nextDate).toBe('2026-07-01')
  })

  it('detects a weekly charge', () => {
    const list = Array.from({ length: 9 }, (_, i) => tx(addDays('2026-08-03', i * 7), -95, 'Getir'))
    const [s] = detectRecurring(list, '2026-10-01')
    expect(s).toMatchObject({ period: 'weekly', annualCost: 4940, nextDate: '2026-10-05' })
  })

  it('detects a yearly charge from two payments', () => {
    const list = [tx('2025-11-03', -3299, 'JetBrains', 'USD'), tx('2026-11-01', -3399, 'JetBrains', 'USD')]
    const [s] = detectRecurring(list, '2026-11-02')
    expect(s).toMatchObject({ period: 'yearly', currency: 'USD', nextDate: '2027-11-01', occurrences: 2 })
  })

  it('follows a price increase within ±15% as one series', () => {
    const list = [...monthly('2026-01-10', 5, -209.99), ...monthly('2026-06-10', 5, -229.99)]
    const series = detectRecurring(list, '2026-10-12')
    expect(series).toHaveLength(1)
    expect(series[0]?.occurrences).toBe(10)
    expect(series[0]?.averageAmount).toBe(229.99)
  })

  it('splits a merchant into separate series when amounts differ by more than 15%', () => {
    const list = [...monthly('2026-03-05', 7, -79.99, 'Apple'), ...monthly('2026-03-20', 7, -399.99, 'Apple')]
    const series = detectRecurring(list, '2026-09-25')
    expect(series.map((s) => s.averageAmount).sort((a, b) => a - b)).toEqual([79.99, 399.99])
    expect(new Set(series.map((s) => s.key)).size).toBe(2)
  })

  it('allows one skipped month but not two in a row', () => {
    const skippedOnce = ['2026-01-05', '2026-02-05', '2026-03-05', '2026-05-05', '2026-06-05', '2026-07-05']
    const [s] = detectRecurring(skippedOnce.map((d) => tx(d, -2400, 'MACFit')), '2026-07-20')
    expect(s).toMatchObject({ period: 'monthly', skipped: 1, occurrences: 6 })

    const skippedTwice = ['2026-01-05', '2026-02-05', '2026-03-05', '2026-06-05', '2026-07-05']
    const result = detectRecurring(skippedTwice.map((d) => tx(d, -2400, 'MACFit')), '2026-07-20')
    // The run before the long gap is broken off; the latest run is too short.
    expect(result).toEqual([])
  })

  it('marks a subscription that stopped as lapsed', () => {
    const [s] = detectRecurring(monthly('2026-01-12', 5, -134.99, 'Disney+'), '2026-10-01')
    expect(s?.status).toBe('lapsed')
  })

  describe('false positives', () => {
    it('ignores grocery runs with varying amounts', () => {
      const r = rng(7)
      const list = Array.from({ length: 40 }, (_, i) => tx(addDays('2026-01-01', i * 6), -(150 + r() * 900), 'Migros'))
      expect(detectRecurring(list, '2026-10-01')).toEqual([])
    })

    it('ignores identical top-ups at irregular intervals', () => {
      const r = rng(11)
      let date = '2026-01-01'
      const list: RecurrenceInput[] = []
      for (let i = 0; i < 30; i++) {
        list.push(tx(date, -200, 'İstanbulkart'))
        date = addDays(date, 2 + Math.floor(r() * 12))
      }
      expect(detectRecurring(list, date)).toEqual([])
    })

    it('needs at least three monthly charges', () => {
      expect(detectRecurring(monthly('2026-08-01', 2, -50), '2026-09-10')).toEqual([])
    })

    it('ignores income and transfers', () => {
      const salary = monthly('2026-01-01', 10, 95000, 'Maaş')
      const card = monthly('2026-01-03', 10, -20000, 'Kart Ödemesi').map((t) => ({ ...t, categoryId: 'transfer' as const }))
      expect(detectRecurring([...salary, ...card], '2026-10-10')).toEqual([])
    })
  })
})
