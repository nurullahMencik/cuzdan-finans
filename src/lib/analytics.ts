import { getCategory } from '../domain/categories'
import type { CategoryId, Transaction } from '../domain/types'
import { daysInMonth, monthOf } from './dates'
import { toTry, type RateTable } from './fx'

/** A transaction with its amount converted to TRY. */
export interface TxTry extends Transaction {
  amountTry: number
}

export function withTry(transactions: readonly Transaction[], rates: RateTable): TxTry[] {
  return transactions.map((t) => ({ ...t, amountTry: toTry(t.amount, t.currency, t.date, rates) }))
}

export interface MonthTotals {
  month: string
  income: number
  expense: number
  net: number
  /** net / income, or null when there is no income. */
  savingsRate: number | null
}

/**
 * Income = money in on non-transfer categories; expense = money out on
 * non-transfer categories, net of refunds. Transfers between own accounts
 * (card payments, currency purchases) are excluded from both.
 */
export function totalsFor(transactions: readonly TxTry[], month: string, throughDay?: number): MonthTotals {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue
    if (throughDay !== undefined && Number(t.date.slice(8, 10)) > throughDay) continue
    const kind = getCategory(t.categoryId).kind
    if (kind === 'transfer') continue
    if (kind === 'income') income += t.amountTry
    else expense -= t.amountTry
  }
  const net = income - expense
  return { month, income, expense, net, savingsRate: income > 0 ? net / income : null }
}

export function monthlySeries(transactions: readonly TxTry[], months: readonly string[]): MonthTotals[] {
  const byMonth = new Map<string, TxTry[]>()
  for (const t of transactions) {
    const m = monthOf(t.date)
    const list = byMonth.get(m)
    if (list) list.push(t)
    else byMonth.set(m, [t])
  }
  return months.map((m) => totalsFor(byMonth.get(m) ?? [], m))
}

export interface CategoryTotal {
  categoryId: CategoryId
  amount: number
  count: number
}

/** Expense per category for a month (positive numbers, refunds netted). */
export function expenseByCategory(transactions: readonly TxTry[], month: string, throughDay?: number): CategoryTotal[] {
  const map = new Map<CategoryId, CategoryTotal>()
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue
    if (throughDay !== undefined && Number(t.date.slice(8, 10)) > throughDay) continue
    if (getCategory(t.categoryId).kind !== 'expense') continue
    const entry = map.get(t.categoryId) ?? { categoryId: t.categoryId, amount: 0, count: 0 }
    entry.amount -= t.amountTry
    entry.count++
    map.set(t.categoryId, entry)
  }
  return [...map.values()].filter((c) => c.amount > 0.005).sort((a, b) => b.amount - a.amount)
}

/** Cumulative daily expense for a month: index 0 is day 1. */
export function cumulativeDailyExpense(transactions: readonly TxTry[], month: string): number[] {
  const days = daysInMonth(month)
  const daily = new Array<number>(days).fill(0)
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue
    if (getCategory(t.categoryId).kind !== 'expense') continue
    const d = Number(t.date.slice(8, 10)) - 1
    daily[d] = (daily[d] ?? 0) - t.amountTry
  }
  let running = 0
  return daily.map((v) => (running += v))
}

/** Relative change, or null when the base is zero. */
export function change(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.005) return null
  return (current - previous) / Math.abs(previous)
}
