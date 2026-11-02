export type CurrencyCode = 'TRY' | 'USD' | 'EUR'

export type AccountType = 'checking' | 'credit' | 'fx'

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  openingBalance: number
  createdAt: string
}

export const CATEGORY_IDS = [
  'salary',
  'other-income',
  'housing',
  'utilities',
  'groceries',
  'dining',
  'transport',
  'shopping',
  'subscriptions',
  'travel',
  'health',
  'entertainment',
  'cash',
  'other',
  'transfer',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export type CategoryKind = 'income' | 'expense' | 'transfer'

/** Where the current category of a transaction came from. */
export type CategorySource = 'rule' | 'manual' | 'default'

export interface Transaction {
  id: string
  accountId: string
  /** ISO calendar date, yyyy-MM-dd. */
  date: string
  /** Raw description exactly as the bank wrote it. */
  description: string
  /** Human readable merchant name derived from the description. */
  merchant: string
  /** Stable grouping key for the merchant (lowercase, ascii). */
  merchantKey: string
  /** Signed amount in the account currency; negative means money out. */
  amount: number
  currency: CurrencyCode
  categoryId: CategoryId
  categorySource: CategorySource
  ruleId?: string
  /** Duplicate detection hash: date + amount + normalized description. */
  hash: string
  importId?: string
}

export type RuleType = 'contains' | 'regex' | 'amount'

export type AmountDirection = 'any' | 'expense' | 'income'

export interface Rule {
  id: string
  type: RuleType
  /** Text for `contains`, pattern for `regex`; unused for `amount`. */
  pattern: string
  /** Inclusive absolute bounds for `amount` rules. */
  min?: number
  max?: number
  direction: AmountDirection
  categoryId: CategoryId
  /** Lower number wins. */
  priority: number
  enabled: boolean
  origin: 'default' | 'user' | 'learned'
  createdAt: string
}

export interface Budget {
  categoryId: CategoryId
  /** Monthly limit in TRY. */
  amount: number
}

export type SubscriptionStatus = 'confirmed' | 'ignored'

export interface SubscriptionDecision {
  key: string
  status: SubscriptionStatus
  decidedAt: string
}

export interface FxRate {
  /** yyyy-MM */
  month: string
  USD: number
  EUR: number
}

export interface ImportRecord {
  id: string
  fileName: string
  accountId: string
  importedAt: string
  added: number
  duplicates: number
  failed: number
}
