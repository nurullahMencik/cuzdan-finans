import type { CurrencyCode, FxRate } from '../domain/types'

export type RateTable = ReadonlyMap<string, FxRate>

export function toRateTable(rates: readonly FxRate[]): RateTable {
  return new Map(rates.map((r) => [r.month, r]))
}

/**
 * Rate for a currency in a month. If that month has no rate, the closest
 * earlier month is used, then the closest later one; 1 only if the table is empty.
 */
export function rateFor(currency: CurrencyCode, month: string, table: RateTable): number {
  if (currency === 'TRY') return 1
  const exact = table.get(month)
  if (exact) return exact[currency]
  let earlier: FxRate | undefined
  let later: FxRate | undefined
  for (const rate of table.values()) {
    if (rate.month < month && (!earlier || rate.month > earlier.month)) earlier = rate
    if (rate.month > month && (!later || rate.month < later.month)) later = rate
  }
  return (earlier ?? later)?.[currency] ?? 1
}

export function toTry(amount: number, currency: CurrencyCode, isoDate: string, table: RateTable): number {
  return currency === 'TRY' ? amount : amount * rateFor(currency, isoDate.slice(0, 7), table)
}
