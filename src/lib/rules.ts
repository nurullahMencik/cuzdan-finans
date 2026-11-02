import type { CategoryId, CategorySource, Rule, Transaction } from '../domain/types'
import { foldDiacritics, foldForMatch } from './text'

export type RuleInput = Pick<Rule, 'type' | 'pattern' | 'min' | 'max' | 'direction'>

type Matchable = Pick<Transaction, 'description' | 'merchant' | 'amount'>

const regexCache = new Map<string, RegExp | null>()

/** Compiles a user regex once; invalid patterns compile to null (never match). */
export function compileRegex(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern)
  if (cached !== undefined) return cached
  let compiled: RegExp | null
  try {
    // Turkish letters are folded in both text and pattern so "ŞOK" matches "SOK".
    compiled = new RegExp(foldDiacritics(pattern), 'i')
  } catch {
    compiled = null
  }
  regexCache.set(pattern, compiled)
  return compiled
}

export function validateRule(rule: RuleInput): 'empty-pattern' | 'invalid-regex' | 'invalid-range' | null {
  switch (rule.type) {
    case 'contains':
      return rule.pattern.trim() ? null : 'empty-pattern'
    case 'regex':
      if (!rule.pattern.trim()) return 'empty-pattern'
      return compileRegex(rule.pattern) ? null : 'invalid-regex'
    case 'amount': {
      const { min, max } = rule
      if (min === undefined && max === undefined) return 'invalid-range'
      if (min !== undefined && max !== undefined && min > max) return 'invalid-range'
      if ((min !== undefined && min < 0) || (max !== undefined && max < 0)) return 'invalid-range'
      return null
    }
  }
}

function haystack(tx: Matchable): string {
  return `${foldForMatch(tx.description)} ${foldForMatch(tx.merchant)}`
}

export function ruleMatches(rule: RuleInput, tx: Matchable): boolean {
  if (rule.direction === 'expense' && tx.amount >= 0) return false
  if (rule.direction === 'income' && tx.amount <= 0) return false
  switch (rule.type) {
    case 'contains': {
      const needle = foldForMatch(rule.pattern)
      return needle.length > 0 && haystack(tx).includes(needle)
    }
    case 'regex': {
      const re = compileRegex(rule.pattern)
      return re !== null && rule.pattern.trim() !== '' && re.test(haystack(tx))
    }
    case 'amount': {
      const abs = Math.abs(tx.amount)
      if (rule.min !== undefined && abs < rule.min) return false
      if (rule.max !== undefined && abs > rule.max) return false
      return rule.min !== undefined || rule.max !== undefined
    }
  }
}

export function sortRules<T extends Pick<Rule, 'priority' | 'createdAt'>>(rules: readonly T[]): T[] {
  return [...rules].sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
}

export interface Categorization {
  categoryId: CategoryId
  categorySource: CategorySource
  ruleId: string | undefined
}

export function fallbackCategory(amount: number): CategoryId {
  return amount > 0 ? 'other-income' : 'other'
}

/**
 * First enabled rule in priority order wins. Manual choices are sticky: a
 * category the user picked by hand is never overwritten by a rule.
 */
export function categorize(
  tx: Matchable & Partial<Pick<Transaction, 'categoryId' | 'categorySource'>>,
  sortedRules: readonly Rule[],
): Categorization {
  if (tx.categorySource === 'manual' && tx.categoryId) {
    return { categoryId: tx.categoryId, categorySource: 'manual', ruleId: undefined }
  }
  for (const rule of sortedRules) {
    if (rule.enabled && ruleMatches(rule, tx)) {
      return { categoryId: rule.categoryId, categorySource: 'rule', ruleId: rule.id }
    }
  }
  return { categoryId: fallbackCategory(tx.amount), categorySource: 'default', ruleId: undefined }
}

/** Re-runs every rule and returns only the transactions whose category changes. */
export function recategorizeAll(transactions: readonly Transaction[], rules: readonly Rule[]): Transaction[] {
  const sorted = sortRules(rules)
  const changed: Transaction[] = []
  for (const tx of transactions) {
    const next = categorize(tx, sorted)
    if (next.categoryId !== tx.categoryId || next.categorySource !== tx.categorySource || next.ruleId !== tx.ruleId) {
      changed.push({ ...tx, ...next })
    }
  }
  return changed
}

export interface RuleImpact {
  matches: number
  /** Transactions whose category would change if the rule were saved. */
  changes: number
  /** Matching transactions that keep a manual category. */
  manualKept: number
  sample: Transaction[]
}

/**
 * Preview for the rule editor: how many transactions the rule would touch
 * when inserted at `priority` among the existing rules.
 */
export function previewRule(
  draft: Omit<Rule, 'id' | 'createdAt'> & { id?: string },
  transactions: readonly Transaction[],
  rules: readonly Rule[],
  sampleSize = 6,
): RuleImpact {
  const candidate: Rule = { ...draft, id: draft.id ?? '__draft__', createdAt: '' }
  const others = rules.filter((r) => r.id !== candidate.id)
  const sorted = sortRules([...others, candidate])
  let matches = 0
  let changes = 0
  let manualKept = 0
  const sample: Transaction[] = []
  for (const tx of transactions) {
    if (!ruleMatches(candidate, tx)) continue
    matches++
    if (tx.categorySource === 'manual') {
      manualKept++
      continue
    }
    const next = categorize(tx, sorted)
    if (next.ruleId === candidate.id && next.categoryId !== tx.categoryId) {
      changes++
      if (sample.length < sampleSize) sample.push(tx)
    }
  }
  return { matches, changes, manualKept, sample }
}

export interface LearnSuggestion {
  rule: Omit<Rule, 'id' | 'createdAt'>
  /** Other transactions from the same merchant that would move category. */
  affected: number
}

/**
 * Learning from a manual correction. When the user moves a transaction to a
 * new category, propose a "contains merchant → category" rule with top
 * priority, unless an existing rule already produces that result.
 */
export function suggestRuleFromCorrection(
  corrected: Transaction,
  newCategory: CategoryId,
  transactions: readonly Transaction[],
  rules: readonly Rule[],
): LearnSuggestion | null {
  const pattern = corrected.merchant.trim()
  if (pattern.length < 2 || corrected.merchant === '-') return null
  const topPriority = rules.reduce((min, r) => Math.min(min, r.priority), 0) - 1
  const rule: Omit<Rule, 'id' | 'createdAt'> = {
    type: 'contains',
    pattern,
    direction: corrected.amount < 0 ? 'expense' : 'income',
    categoryId: newCategory,
    priority: topPriority,
    enabled: true,
    origin: 'learned',
  }
  const existing = categorize({ ...corrected, categorySource: 'rule' }, sortRules(rules))
  const sameMerchant = transactions.filter((t) => t.id !== corrected.id && t.merchantKey === corrected.merchantKey)
  const affected = sameMerchant.filter((t) => t.categorySource !== 'manual' && t.categoryId !== newCategory && ruleMatches(rule, t)).length
  if (existing.categorySource === 'rule' && existing.categoryId === newCategory && affected === 0) return null
  return { rule, affected }
}

/** Moves an item and renumbers priorities 0..n-1. */
export function reorderRules(rules: readonly Rule[], fromIndex: number, toIndex: number): Rule[] {
  const list = sortRules(rules)
  const [moved] = list.splice(fromIndex, 1)
  if (!moved) return list
  list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, moved)
  return list.map((r, i) => ({ ...r, priority: i }))
}
