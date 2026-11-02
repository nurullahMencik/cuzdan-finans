import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createFormatters, type Locale } from './format'
import { format, I18nContext, LOCALE_STORAGE_KEY, loadMessages, type I18n, type Translate } from './context'
import type { Messages } from './tr'

interface Props {
  initialLocale: Locale
  initialMessages: Messages
  children: ReactNode
}

export function I18nProvider({ initialLocale, initialMessages, children }: Props) {
  const [{ locale, messages }, setState] = useState({ locale: initialLocale, messages: initialMessages })

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    void loadMessages(next).then((loaded) => {
      setState({ locale: next, messages: loaded })
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next)
      } catch {
        // Not persisted; the choice still applies for this session.
      }
    })
  }, [])

  const value = useMemo<I18n>(() => {
    const plural = new Intl.PluralRules(locale === 'tr' ? 'tr-TR' : 'en-US')
    const t: Translate = (key, vars) => format(messages[key], vars, plural)
    return { locale, setLocale, t, f: createFormatters(locale) }
  }, [locale, messages, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
