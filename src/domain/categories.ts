import type { CategoryId, CategoryKind } from './types'

export interface CategoryMeta {
  id: CategoryId
  kind: CategoryKind
  /**
   * Index into the categorical chart palette (1-8) or `null` for categories
   * that are always folded into "Other" in part-to-whole charts. Colour
   * follows the category, never its rank, so the same category looks the
   * same in every chart and list.
   */
  slot: number | null
  /** Fixed-cost categories are not linearly extrapolated in forecasts. */
  fixed: boolean
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'salary', kind: 'income', slot: null, fixed: true },
  { id: 'other-income', kind: 'income', slot: null, fixed: false },
  { id: 'groceries', kind: 'expense', slot: 1, fixed: false },
  { id: 'dining', kind: 'expense', slot: 2, fixed: false },
  { id: 'transport', kind: 'expense', slot: 3, fixed: false },
  { id: 'utilities', kind: 'expense', slot: 4, fixed: true },
  { id: 'shopping', kind: 'expense', slot: 5, fixed: false },
  { id: 'travel', kind: 'expense', slot: 6, fixed: false },
  { id: 'housing', kind: 'expense', slot: 7, fixed: true },
  { id: 'subscriptions', kind: 'expense', slot: 8, fixed: true },
  { id: 'health', kind: 'expense', slot: null, fixed: false },
  { id: 'entertainment', kind: 'expense', slot: null, fixed: false },
  { id: 'cash', kind: 'expense', slot: null, fixed: false },
  { id: 'other', kind: 'expense', slot: null, fixed: false },
  { id: 'transfer', kind: 'transfer', slot: null, fixed: false },
]

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id: CategoryId): CategoryMeta {
  const meta = BY_ID.get(id)
  if (!meta) throw new Error(`Unknown category: ${id}`)
  return meta
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId)
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'expense')

/** CSS custom property holding the category colour (defined in index.css). */
export function categoryColorVar(id: CategoryId): string {
  const meta = getCategory(id)
  return meta.slot === null ? `var(--cat-neutral-${neutralIndex(id)})` : `var(--series-${meta.slot})`
}

const NEUTRAL_INDEX: Partial<Record<CategoryId, number>> = {
  health: 1,
  entertainment: 2,
  cash: 3,
  salary: 4,
  'other-income': 4,
  transfer: 3,
}

function neutralIndex(id: CategoryId): number {
  return NEUTRAL_INDEX[id] ?? 2
}
