import { createContext, useContext } from 'react'
import type { Formatters, Locale } from './format'
import { tr, type MessageKey, type Messages } from './tr'

export type Vars = Record<string, string | number>
export type Translate = (key: MessageKey, vars?: Vars) => string

export interface I18n {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
  f: Formatters
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export const LOCALE_STORAGE_KEY = 'cuzdan.locale'

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'tr' || stored === 'en') return stored
  } catch {
    // Storage can be unavailable (private mode); fall back to Turkish.
  }
  return 'tr'
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'en') return (await import('./en')).en
  return tr
}

/** Picks a plural form ("one|other") and fills {placeholders}. */
export function format(message: string, vars: Vars | undefined, plural: Intl.PluralRules): string {
  let text = message
  if (text.includes('|')) {
    const forms = text.split('|')
    const count = typeof vars?.count === 'number' ? vars.count : undefined
    const index = count !== undefined && plural.select(count) === 'one' ? 0 : forms.length - 1
    text = forms[index] ?? text
  }
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}
