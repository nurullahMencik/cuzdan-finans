import { describe, expect, it } from 'vitest'
import { detectRecurring } from '../recurrence'
import { generateSampleData } from './generate'

describe('generateSampleData', () => {
  const today = new Date(2026, 10, 2)
  const data = generateSampleData(today)

  it('is deterministic for the same day', () => {
    const again = generateSampleData(new Date(2026, 10, 2))
    expect(again.transactions).toEqual(data.transactions)
  })

  it('covers the last twelve months with 2000+ transactions up to today', () => {
    expect(data.transactions.length).toBeGreaterThan(2000)
    const dates = data.transactions.map((t) => t.date).sort()
    expect(dates[0]).toBe('2025-11-01')
    expect(dates[dates.length - 1]! <= '2026-11-02').toBe(true)
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(data.transactions.length)
  })

  it('looks like a real statement and is fully categorised by the starter rules', () => {
    const descriptions = new Set(data.transactions.map((t) => t.description))
    expect(descriptions).toContain('POS NETFLIX.COM 4589 ISTANBUL')
    expect(descriptions).toContain('EFT MAAS ODEMESI ANADOLU YAZILIM AS')
    const uncategorised = data.transactions.filter((t) => t.categorySource === 'default')
    // Only person-to-person transfers and a few one-off merchants stay uncategorised.
    expect(uncategorised.length / data.transactions.length).toBeLessThan(0.03)
  })

  it('contains the subscriptions the detector should find', () => {
    const found = detectRecurring(data.transactions, '2026-11-02')
    const byName = new Map(found.map((s) => [s.merchant, s]))
    expect(byName.get('Netflix')?.period).toBe('monthly')
    expect(byName.get('Arena Halı Saha')?.period).toBe('weekly')
    expect(byName.get('JetBrains')?.period).toBe('yearly')
    expect(byName.get('MACFit')?.skipped).toBe(1)
    expect(byName.get('Disney+')?.status).toBe('lapsed')
    // No supermarket or bakery shows up as a subscription.
    for (const name of ['Migros', 'BİM', 'A101', 'ŞOK', 'Anadolu Fırını', 'İstanbulkart']) expect(byName.has(name)).toBe(false)
  })

  it('shows seasonal patterns: winter gas bills and a summer holiday', () => {
    const gas = (month: string) =>
      -data.transactions.filter((t) => t.merchant === 'İGDAŞ' && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0)
    expect(gas('2026-01')).toBeGreaterThan(gas('2026-07') * 4)
    expect(data.transactions.some((t) => t.categoryId === 'travel' && t.date.startsWith('2026-08'))).toBe(true)
  })
})
