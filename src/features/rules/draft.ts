import type { AmountDirection, CategoryId, Rule, RuleType } from '../../domain/types'

export interface RuleDraft {
  id?: string
  createdAt?: string
  origin: Rule['origin']
  type: RuleType
  pattern: string
  min: string
  max: string
  direction: AmountDirection
  categoryId: CategoryId
  enabled: boolean
  position: 'top' | 'bottom' | 'keep'
  priority?: number
}

export function draftFromRule(rule: Rule): RuleDraft {
  return {
    id: rule.id,
    createdAt: rule.createdAt,
    origin: rule.origin,
    type: rule.type,
    pattern: rule.pattern,
    min: rule.min !== undefined ? String(rule.min) : '',
    max: rule.max !== undefined ? String(rule.max) : '',
    direction: rule.direction,
    categoryId: rule.categoryId,
    enabled: rule.enabled,
    position: 'keep',
    priority: rule.priority,
  }
}

export const EMPTY_DRAFT: RuleDraft = {
  origin: 'user',
  type: 'contains',
  pattern: '',
  min: '',
  max: '',
  direction: 'any',
  categoryId: 'groceries',
  enabled: true,
  position: 'top',
}

const parseAmount = (v: string) => {
  if (!v.trim()) return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Converts the form draft into a rule at its target priority. */
export function toRule(draft: RuleDraft, rules: readonly Rule[]): Omit<Rule, 'id' | 'createdAt'> & { id?: string; createdAt?: string } {
  const priorities = rules.filter((r) => r.id !== draft.id).map((r) => r.priority)
  const priority =
    draft.position === 'top'
      ? Math.min(0, ...priorities) - 1
      : draft.position === 'bottom'
        ? Math.max(0, ...priorities) + 1
        : (draft.priority ?? 0)
  const min = draft.type === 'amount' ? parseAmount(draft.min) : undefined
  const max = draft.type === 'amount' ? parseAmount(draft.max) : undefined
  return {
    ...(draft.id ? { id: draft.id } : {}),
    ...(draft.createdAt ? { createdAt: draft.createdAt } : {}),
    type: draft.type,
    pattern: draft.type === 'amount' ? '' : draft.pattern.trim(),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    direction: draft.direction,
    categoryId: draft.categoryId,
    priority,
    enabled: draft.enabled,
    origin: draft.origin,
  }
}

