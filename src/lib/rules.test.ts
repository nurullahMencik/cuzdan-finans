import { describe, expect, it } from 'vitest'
import type { Rule, Transaction } from '../domain/types'
import { normalizeMerchant } from './merchant'
import { categorize, previewRule, recategorizeAll, reorderRules, ruleMatches, sortRules, suggestRuleFromCorrection, validateRule } from './rules'

function rule(partial: Partial<Rule> & Pick<Rule, 'id' | 'categoryId'>): Rule {
  return {
    type: 'contains',
    pattern: '',
    direction: 'any',
    priority: 0,
    enabled: true,
    origin: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

let seq = 0
function tx(description: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  const m = normalizeMerchant(description)
  seq++
  return {
    id: `tx${seq}`,
    accountId: 'card',
    date: '2026-10-01',
    description,
    merchant: m.name,
    merchantKey: m.key,
    amount,
    currency: 'TRY',
    categoryId: 'other',
    categorySource: 'default',
    hash: `h${seq}`,
    ...extra,
  }
}

describe('rule matching', () => {
  it('matches "contains" case- and Turkish-insensitively against description and merchant', () => {
    const r = rule({ id: 'r', categoryId: 'groceries', pattern: 'şok' })
    expect(ruleMatches(r, tx('POS SOK MARKETLER 0042', -120))).toBe(true)
    expect(ruleMatches(r, tx('POS SOKAK LEZZETLERI', -120))).toBe(true) // substring by design
    const icloud = rule({ id: 'i', categoryId: 'subscriptions', pattern: 'icloud' })
    expect(ruleMatches(icloud, tx('APPLE.COM/BILL 0800', -39.99))).toBe(true) // via merchant name
  })

  it('supports regex and rejects invalid patterns', () => {
    const r = rule({ id: 'r', type: 'regex', categoryId: 'groceries', pattern: '\\b(BİM|A101)\\b' })
    expect(ruleMatches(r, tx('POS BIM BIRLESIK 1234', -80))).toBe(true)
    expect(ruleMatches(r, tx('POS BIMBO CAFE', -80))).toBe(false)
    expect(validateRule({ type: 'regex', pattern: '(unclosed', direction: 'any' })).toBe('invalid-regex')
    expect(ruleMatches(rule({ id: 'x', type: 'regex', categoryId: 'other', pattern: '(unclosed' }), tx('anything', -1))).toBe(false)
  })

  it('matches amount ranges on absolute value with an optional direction', () => {
    const rent = rule({ id: 'r', type: 'amount', categoryId: 'housing', min: 20000, max: 40000, direction: 'expense' })
    expect(ruleMatches(rent, tx('HAVALE KIRA', -30000))).toBe(true)
    expect(ruleMatches(rent, tx('EFT GELEN', 30000))).toBe(false)
    expect(ruleMatches(rent, tx('HAVALE', -45000))).toBe(false)
    expect(validateRule({ type: 'amount', pattern: '', min: 50, max: 10, direction: 'any' })).toBe('invalid-range')
  })
})

describe('priority', () => {
  const rules = [
    rule({ id: 'generic', categoryId: 'shopping', pattern: 'POS', priority: 5 }),
    rule({ id: 'specific', categoryId: 'groceries', pattern: 'MIGROS', priority: 1 }),
    rule({ id: 'disabled', categoryId: 'health', pattern: 'MIGROS', priority: 0, enabled: false }),
  ]

  it('applies the first enabled rule in priority order', () => {
    const result = categorize(tx('POS MIGROS 4567', -500), sortRules(rules))
    expect(result).toEqual({ categoryId: 'groceries', categorySource: 'rule', ruleId: 'specific' })
  })

  it('falls back by sign when nothing matches', () => {
    expect(categorize(tx('EFT GELEN', 100), []).categoryId).toBe('other-income')
    expect(categorize(tx('BILINMEYEN', -100), []).categoryId).toBe('other')
  })

  it('never overrides a manual choice', () => {
    const manual = tx('POS MIGROS 4567', -500, { categoryId: 'dining', categorySource: 'manual' })
    expect(categorize(manual, sortRules(rules)).categoryId).toBe('dining')
    expect(recategorizeAll([manual], rules)).toEqual([])
  })

  it('reorders and renumbers priorities', () => {
    const reordered = reorderRules(rules, 2, 0)
    expect(reordered.map((r) => [r.id, r.priority])).toEqual([
      ['generic', 0],
      ['disabled', 1],
      ['specific', 2],
    ])
    expect(categorize(tx('POS MIGROS 4567', -500), sortRules(reordered)).ruleId).toBe('generic')
  })
})

describe('learning from corrections', () => {
  const rules = [
    rule({ id: 'food', categoryId: 'dining', pattern: 'GETIR', priority: 0 }),
    rule({ id: 'market', categoryId: 'groceries', pattern: 'MIGROS', priority: 1 }),
  ]
  const history = [
    tx('POS GETIR PERAKENDE 0001', -320, { categoryId: 'dining', categorySource: 'rule', ruleId: 'food' }),
    tx('POS GETIR PERAKENDE 0002', -410, { categoryId: 'dining', categorySource: 'rule', ruleId: 'food' }),
    tx('POS GETIR PERAKENDE 0003', -275, { categoryId: 'health', categorySource: 'manual' }),
    tx('POS MIGROS 4567', -900, { categoryId: 'groceries', categorySource: 'rule', ruleId: 'market' }),
  ]

  it('proposes a top-priority merchant rule and counts affected transactions', () => {
    const corrected = history[0]!
    const suggestion = suggestRuleFromCorrection(corrected, 'groceries', history, rules)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.rule).toMatchObject({ type: 'contains', pattern: 'Getir', categoryId: 'groceries', direction: 'expense' })
    expect(suggestion?.rule.priority).toBeLessThan(0)
    // The other auto-categorized Getir purchase moves; the manual one is kept.
    expect(suggestion?.affected).toBe(1)
  })

  it('makes the learned rule win over older rules after saving', () => {
    const suggestion = suggestRuleFromCorrection(history[0]!, 'groceries', history, rules)!
    const learned: Rule = { ...suggestion.rule, id: 'learned', createdAt: '2026-10-02T00:00:00.000Z' }
    const changed = recategorizeAll(history, [...rules, learned])
    expect(changed.map((t) => [t.description, t.categoryId])).toEqual([
      ['POS GETIR PERAKENDE 0001', 'groceries'],
      ['POS GETIR PERAKENDE 0002', 'groceries'],
    ])
  })

  it('does not suggest a rule the existing rules already imply', () => {
    expect(suggestRuleFromCorrection(history[0]!, 'dining', history, rules)).toBeNull()
  })

  it('previews the impact of a draft rule before saving', () => {
    const impact = previewRule(
      { type: 'contains', pattern: 'getir', direction: 'any', categoryId: 'groceries', priority: -1, enabled: true, origin: 'user' },
      history,
      rules,
    )
    expect(impact).toMatchObject({ matches: 3, changes: 2, manualKept: 1 })
  })
})
