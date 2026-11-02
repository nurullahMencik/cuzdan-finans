import { getCategory } from '../../domain/categories'
import type { Budget, CategoryId } from '../../domain/types'
import { expenseByCategory, type TxTry } from '../../lib/analytics'
import { budgetStatus, forecastMonthEnd, type BudgetStatus } from '../../lib/budget'
import { addMonthsToMonth, daysInMonth } from '../../lib/dates'

export interface BudgetRow {
  categoryId: CategoryId
  limit: number
  spent: number
  forecast: number
  status: BudgetStatus
  /** Amount you could have spent by today while staying on budget. */
  pace: number
  isFixed: boolean
  typical: number | undefined
}

/** Average monthly spend per category over the previous three months that have data. */
export function typicalSpend(transactions: readonly TxTry[], month: string): Map<CategoryId, number> {
  const totals = new Map<CategoryId, number[]>()
  for (let i = 1; i <= 3; i++) {
    const m = addMonthsToMonth(month, -i)
    const byCategory = expenseByCategory(transactions, m)
    if (byCategory.length === 0) continue
    for (const c of byCategory) totals.set(c.categoryId, [...(totals.get(c.categoryId) ?? []), c.amount])
  }
  const out = new Map<CategoryId, number>()
  for (const [id, values] of totals) out.set(id, values.reduce((s, v) => s + v, 0) / values.length)
  return out
}

export function computeBudgetRows(
  transactions: readonly TxTry[],
  budgets: readonly Budget[],
  month: string,
  throughDay: number,
): BudgetRow[] {
  const spentBy = new Map(expenseByCategory(transactions, month).map((c) => [c.categoryId, c.amount]))
  const typical = typicalSpend(transactions, month)
  const days = daysInMonth(month)
  return budgets
    .map((b): BudgetRow => {
      const spent = spentBy.get(b.categoryId) ?? 0
      const isFixed = getCategory(b.categoryId).fixed
      const typ = typical.get(b.categoryId)
      const forecast = forecastMonthEnd({ spent, dayOfMonth: throughDay, daysInMonth: days, isFixed, typicalMonthly: typ })
      return {
        categoryId: b.categoryId,
        limit: b.amount,
        spent,
        forecast,
        status: budgetStatus(spent, forecast, b.amount),
        pace: (b.amount * Math.min(throughDay, days)) / days,
        isFixed,
        typical: typ,
      }
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
}

export const STATUS_ORDER: Record<BudgetStatus, number> = { over: 0, 'at-risk': 1, warning: 2, ok: 3 }
