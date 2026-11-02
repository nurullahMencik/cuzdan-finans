import { isCategoryId } from '../../domain/categories'
import type { CategoryId } from '../../domain/types'
import type { TxTry } from '../../lib/analytics'
import { foldForMatch } from '../../lib/text'

export interface TxFilters {
  q: string
  account: string
  category: CategoryId | ''
  from: string
  to: string
  /** Absolute amount bounds in TRY. */
  min: number | null
  max: number | null
  importId: string
}

export const FILTER_KEYS = ['q', 'account', 'category', 'from', 'to', 'min', 'max', 'import'] as const

function num(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseFilters(params: URLSearchParams): TxFilters {
  const category = params.get('category') ?? ''
  return {
    q: params.get('q') ?? '',
    account: params.get('account') ?? '',
    category: isCategoryId(category) ? category : '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    min: num(params.get('min')),
    max: num(params.get('max')),
    importId: params.get('import') ?? '',
  }
}

export function activeFilterCount(f: TxFilters): number {
  return [f.account, f.category, f.from, f.to, f.min !== null ? 'x' : '', f.max !== null ? 'x' : '', f.importId].filter(Boolean).length
}

/** Applies every filter; search is case- and Turkish-letter insensitive. */
export function filterTransactions<T extends TxTry>(rows: readonly T[], f: TxFilters): T[] {
  const needle = foldForMatch(f.q)
  return rows.filter((t) => {
    if (f.account && t.accountId !== f.account) return false
    if (f.category && t.categoryId !== f.category) return false
    if (f.importId && t.importId !== f.importId) return false
    if (f.from && t.date < f.from) return false
    if (f.to && t.date > f.to) return false
    const abs = Math.abs(t.amountTry)
    if (f.min !== null && abs < f.min) return false
    if (f.max !== null && abs > f.max) return false
    if (needle && !foldForMatch(`${t.description} ${t.merchant}`).includes(needle)) return false
    return true
  })
}
