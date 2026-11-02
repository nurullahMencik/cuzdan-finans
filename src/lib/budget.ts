export interface ForecastInput {
  /** Spent so far this month (positive, TRY). */
  spent: number
  /** Day of month the data runs through (1-based). */
  dayOfMonth: number
  daysInMonth: number
  /**
   * Fixed-cost categories (rent, bills, subscriptions) are paid once, so a
   * linear projection would wildly overshoot after an early-month payment.
   */
  isFixed?: boolean
  /** Typical monthly total for this category (e.g. last 3 months' average). */
  typicalMonthly?: number
}

/**
 * Month-end forecast at the current daily pace.
 * Variable spending: spent / elapsed days × days in month.
 * Fixed costs: the larger of what is already spent and the usual monthly bill.
 */
export function forecastMonthEnd(input: ForecastInput): number {
  const { spent, daysInMonth } = input
  const day = Math.min(Math.max(input.dayOfMonth, 0), daysInMonth)
  if (day >= daysInMonth) return round2(spent)
  if (input.isFixed) return round2(Math.max(spent, input.typicalMonthly ?? spent))
  if (day === 0) return round2(Math.max(spent, input.typicalMonthly ?? 0))
  const linear = (spent / day) * daysInMonth
  // Very early in the month a single purchase dominates the pace; blend in
  // the typical month until a third of the month has passed.
  if (input.typicalMonthly !== undefined && day < daysInMonth / 3) {
    const weight = day / (daysInMonth / 3)
    return round2(Math.max(spent, linear * weight + input.typicalMonthly * (1 - weight)))
  }
  return round2(linear)
}

export type BudgetStatus = 'ok' | 'warning' | 'at-risk' | 'over'

/**
 * over: already above the limit. at-risk: forecast exceeds the limit.
 * warning: 80% used. ok: otherwise.
 */
export function budgetStatus(spent: number, forecast: number, limit: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? 'over' : 'ok'
  if (spent > limit) return 'over'
  if (forecast > limit) return 'at-risk'
  if (spent >= limit * 0.8) return 'warning'
  return 'ok'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
