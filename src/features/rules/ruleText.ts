import { useCallback } from 'react'
import type { Rule } from '../../domain/types'
import { useI18n } from '../../i18n/context'

/** Human readable one-line summary of a rule's condition. */
export function useRuleText(): (rule: Pick<Rule, 'type' | 'pattern' | 'min' | 'max' | 'direction'>) => string {
  const { t, f } = useI18n()
  return useCallback(
    (rule) => {
      const direction = rule.direction === 'any' ? '' : ` · ${t(`rules.direction.${rule.direction}`)}`
      switch (rule.type) {
        case 'contains':
          return t('rules.describe.contains', { pattern: rule.pattern }) + direction
        case 'regex':
          return t('rules.describe.regex', { pattern: rule.pattern }) + direction
        case 'amount': {
          const min = rule.min !== undefined ? f.money(rule.min, 'TRY', { decimals: 0 }) : null
          const max = rule.max !== undefined ? f.money(rule.max, 'TRY', { decimals: 0 }) : null
          const range = min && max ? `${min} – ${max}` : min ? t('rules.describe.min', { min }) : t('rules.describe.max', { max: max ?? '' })
          return t('rules.describe.amount', { range }) + direction
        }
      }
    },
    [t, f],
  )
}
