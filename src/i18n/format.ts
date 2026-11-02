import { format as formatDate } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { tr as trLocale } from 'date-fns/locale/tr'
import type { CurrencyCode } from '../domain/types'

export type Locale = 'tr' | 'en'

export interface Formatters {
  locale: Locale
  /** BCP 47 tag used by Intl. */
  tag: string
  money: (amount: number, currency?: CurrencyCode, options?: { signed?: boolean; decimals?: 0 | 2 }) => string
  moneyCompact: (amount: number) => string
  number: (value: number, decimals?: number) => string
  percent: (ratio: number, options?: { signed?: boolean; decimals?: number }) => string
  /** ISO yyyy-MM-dd → localized date, e.g. "12 Eki 2026". */
  date: (iso: string, pattern?: string) => string
  /** yyyy-MM → "Ekim 2026". */
  month: (month: string) => string
  /** yyyy-MM → "Eki". */
  monthShort: (month: string) => string
}

function isoToLocalDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function createFormatters(locale: Locale): Formatters {
  const tag = locale === 'tr' ? 'tr-TR' : 'en-US'
  const dfLocale = locale === 'tr' ? trLocale : enUS
  const cache = new Map<string, Intl.NumberFormat>()
  const nf = (key: string, options: Intl.NumberFormatOptions) => {
    let f = cache.get(key)
    if (!f) {
      f = new Intl.NumberFormat(tag, options)
      cache.set(key, f)
    }
    return f
  }

  return {
    locale,
    tag,
    money(amount, currency = 'TRY', options = {}) {
      const decimals = options.decimals ?? 2
      const key = `m|${currency}|${decimals}|${options.signed ? 1 : 0}`
      return nf(key, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        signDisplay: options.signed ? 'exceptZero' : 'auto',
      }).format(Math.abs(amount) < 0.005 ? 0 : amount)
    },
    moneyCompact(amount) {
      return nf('mc', {
        style: 'currency',
        currency: 'TRY',
        currencyDisplay: 'narrowSymbol',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount)
    },
    number(value, decimals = 0) {
      return nf(`n|${decimals}`, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
    },
    percent(ratio, options = {}) {
      const decimals = options.decimals ?? 0
      return nf(`p|${decimals}|${options.signed ? 1 : 0}`, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
        signDisplay: options.signed ? 'exceptZero' : 'auto',
      }).format(ratio)
    },
    date(iso, pattern = 'd MMM yyyy') {
      return formatDate(isoToLocalDate(iso), pattern, { locale: dfLocale })
    },
    month(month) {
      return formatDate(isoToLocalDate(`${month}-01`), 'LLLL yyyy', { locale: dfLocale })
    },
    monthShort(month) {
      return formatDate(isoToLocalDate(`${month}-01`), 'LLL', { locale: dfLocale })
    },
  }
}
