import { describe, expect, it } from 'vitest'
import { budgetStatus, forecastMonthEnd } from './budget'

describe('forecastMonthEnd', () => {
  it('projects variable spending at the current daily pace', () => {
    expect(forecastMonthEnd({ spent: 3000, dayOfMonth: 15, daysInMonth: 30 })).toBe(6000)
    expect(forecastMonthEnd({ spent: 1000, dayOfMonth: 20, daysInMonth: 31 })).toBe(1550)
  })

  it('returns the actual total once the month is over', () => {
    expect(forecastMonthEnd({ spent: 4321, dayOfMonth: 30, daysInMonth: 30 })).toBe(4321)
    expect(forecastMonthEnd({ spent: 4321, dayOfMonth: 31, daysInMonth: 30 })).toBe(4321)
  })

  it('does not extrapolate fixed costs paid early in the month', () => {
    expect(forecastMonthEnd({ spent: 30000, dayOfMonth: 2, daysInMonth: 30, isFixed: true, typicalMonthly: 30000 })).toBe(30000)
    expect(forecastMonthEnd({ spent: 0, dayOfMonth: 2, daysInMonth: 30, isFixed: true, typicalMonthly: 1200 })).toBe(1200)
  })

  it('blends in the typical month early on so one purchase does not dominate', () => {
    // Day 2 of 30, one big shop: pure linear would say 15 000.
    const f = forecastMonthEnd({ spent: 1000, dayOfMonth: 2, daysInMonth: 30, typicalMonthly: 9000 })
    expect(f).toBeGreaterThan(9000)
    expect(f).toBeLessThan(15000)
    expect(f).toBe(10200) // 0.2 × 15 000 + 0.8 × 9 000
  })

  it('never forecasts below what is already spent', () => {
    expect(forecastMonthEnd({ spent: 5000, dayOfMonth: 1, daysInMonth: 30, typicalMonthly: 100 })).toBeGreaterThanOrEqual(5000)
  })

  it('handles day zero without dividing by zero', () => {
    expect(forecastMonthEnd({ spent: 0, dayOfMonth: 0, daysInMonth: 30 })).toBe(0)
  })
})

describe('budgetStatus', () => {
  it.each([
    [500, 900, 1000, 'ok'],
    [850, 950, 1000, 'warning'],
    [600, 1200, 1000, 'at-risk'],
    [1100, 1300, 1000, 'over'],
  ] as const)('spent %d, forecast %d, limit %d → %s', (spent, forecast, limit, expected) => {
    expect(budgetStatus(spent, forecast, limit)).toBe(expected)
  })
})
