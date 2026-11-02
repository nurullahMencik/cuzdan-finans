import { describe, expect, it } from 'vitest'
import type { TxTry } from '../../lib/analytics'
import { toCsv } from './exportCsv'
import { activeFilterCount, filterTransactions, parseFilters } from './filter'

const base: Omit<TxTry, 'id' | 'description' | 'merchant' | 'amount' | 'amountTry' | 'date'> = {
  accountId: 'card',
  merchantKey: 'x',
  currency: 'TRY',
  categoryId: 'groceries',
  categorySource: 'rule',
  hash: 'h',
}
const rows: TxTry[] = [
  { ...base, id: '1', date: '2026-10-01', description: 'POS MİGROS 4567', merchant: 'Migros', amount: -850, amountTry: -850 },
  { ...base, id: '2', date: '2026-10-05', description: 'POS SIMIT SARAYI', merchant: 'Simit Sarayı', amount: -60, amountTry: -60, categoryId: 'dining' },
  { ...base, id: '3', date: '2026-10-09', description: 'GITHUB', merchant: 'GitHub', amount: -10, amountTry: -484, currency: 'USD', accountId: 'usd' },
]

describe('transaction filters', () => {
  it('parses URL params and ignores unknown categories', () => {
    const f = parseFilters(new URLSearchParams('q=migros&category=nope&min=100&max=abc&account=card'))
    expect(f).toMatchObject({ q: 'migros', category: '', min: 100, max: null, account: 'card' })
    expect(activeFilterCount(f)).toBe(2)
  })

  it('searches without caring about case or Turkish letters', () => {
    const f = parseFilters(new URLSearchParams('q=migros'))
    expect(filterTransactions(rows, f).map((r) => r.id)).toEqual(['1'])
    expect(filterTransactions(rows, parseFilters(new URLSearchParams('q=sarayi'))).map((r) => r.id)).toEqual(['2'])
  })

  it('combines account, category, date and TRY amount ranges', () => {
    expect(filterTransactions(rows, parseFilters(new URLSearchParams('from=2026-10-02&to=2026-10-31'))).map((r) => r.id)).toEqual(['2', '3'])
    // USD row is 10 USD but 484 TRY: amount filters use the TRY value.
    expect(filterTransactions(rows, parseFilters(new URLSearchParams('min=100&max=500'))).map((r) => r.id)).toEqual(['3'])
    expect(filterTransactions(rows, parseFilters(new URLSearchParams('category=dining'))).map((r) => r.id)).toEqual(['2'])
  })
})

describe('toCsv', () => {
  const cols = [
    { header: 'Açıklama', value: (r: TxTry) => r.description },
    { header: 'Tutar', value: (r: TxTry) => r.amount },
  ]
  it('writes Turkish CSV with ; and decimal commas, quoting when needed', () => {
    const csv = toCsv([{ ...rows[0]!, description: 'A;B "C"' }], cols, 'tr')
    expect(csv).toBe('\uFEFFAçıklama;Tutar\r\n"A;B ""C""";-850,00\r\n')
  })
  it('writes English CSV with , and decimal points', () => {
    expect(toCsv([rows[1]!], cols, 'en')).toBe('\uFEFFAçıklama,Tutar\r\nPOS SIMIT SARAYI,-60.00\r\n')
  })
})
