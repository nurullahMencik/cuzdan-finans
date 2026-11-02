import { foldForMatch } from '../text'
import { detectDateFormat, detectDecimalFormat, parseAmount, type DateFormat, type DecimalFormat } from './formats'

export type Delimiter = ';' | ',' | '\t' | '|'
export const DELIMITERS: readonly Delimiter[] = [';', ',', '\t', '|']

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch === delimiter) count++
  }
  return count
}

/**
 * Chooses the delimiter whose per-line count is most consistent. Turkish
 * exports use ";" because "," is the decimal separator, so a raw comma count
 * would be misleading; consistency across lines is what separates them.
 */
export function detectDelimiter(text: string): Delimiter {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 40)
  let best: { delimiter: Delimiter; score: number } = { delimiter: ';', score: -1 }
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((l) => countOutsideQuotes(l, delimiter)).filter((c) => c > 0)
    if (counts.length === 0) continue
    const freq = new Map<number, number>()
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1)
    let modeCount = 0
    let modeFreq = 0
    for (const [c, f] of freq) {
      if (f > modeFreq || (f === modeFreq && c > modeCount)) {
        modeCount = c
        modeFreq = f
      }
    }
    // Lines that agree on the column count, weighted slightly by column count.
    const score = modeFreq * 10 + Math.min(modeCount, 12)
    if (score > best.score) best = { delimiter, score }
  }
  return best.delimiter
}

const HEADER_HINTS = {
  date: ['TARIH', 'ISLEM TARIHI', 'VALOR', 'DATE', 'TRANSACTION DATE', 'POSTING DATE'],
  description: ['ACIKLAMA', 'ISLEM ACIKLAMASI', 'ISLEM', 'DETAY', 'DESCRIPTION', 'DETAILS', 'MERCHANT', 'NARRATIVE'],
  amount: ['TUTAR', 'ISLEM TUTARI', 'MIKTAR', 'AMOUNT', 'VALUE'],
  debit: ['BORC', 'CIKAN', 'GIDEN', 'DEBIT', 'WITHDRAWAL', 'MONEY OUT'],
  credit: ['ALACAK', 'GIREN', 'GELEN', 'CREDIT', 'DEPOSIT', 'MONEY IN'],
  balance: ['BAKIYE', 'BALANCE'],
} as const

type HintKey = keyof typeof HEADER_HINTS

function headerKind(cell: string): HintKey | null {
  const v = foldForMatch(cell)
  if (!v) return null
  let best: { key: HintKey; len: number } | null = null
  for (const key of Object.keys(HEADER_HINTS) as HintKey[]) {
    for (const hint of HEADER_HINTS[key]) {
      const matches = v === hint || v.startsWith(`${hint} `) || v.endsWith(` ${hint}`) || v.includes(hint)
      if (matches && (!best || hint.length > best.len)) best = { key, len: hint.length }
    }
  }
  return best?.key ?? null
}

/** Finds the header row: the early row with the most recognisable column names. */
export function detectHeaderRow(rows: readonly (readonly string[])[]): number {
  let bestIndex = 0
  let bestScore = 0
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    const kinds = new Set(row.map(headerKind).filter((k): k is HintKey => k !== null))
    let score = kinds.size
    if (kinds.has('date')) score += 1
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return bestIndex
}

export type AmountMode = 'single' | 'split'

export interface ColumnMapping {
  date: number
  description: number
  amountMode: AmountMode
  amount: number
  debit: number
  credit: number
}

export const NO_COLUMN = -1

/** Guesses the column mapping from header names, then from cell content. */
export function guessMapping(header: readonly string[], sample: readonly (readonly string[])[]): ColumnMapping {
  const kinds = header.map(headerKind)
  const find = (k: HintKey) => kinds.indexOf(k)
  let date = find('date')
  let description = find('description')
  const amount = find('amount')
  const debit = find('debit')
  const credit = find('credit')

  if (date === NO_COLUMN) {
    date = header.findIndex((_, i) => detectDateFormat(sample.map((r) => r[i] ?? '')) !== null)
  }
  if (description === NO_COLUMN) {
    // The longest average text column is almost always the description.
    let bestLen = 0
    header.forEach((_, i) => {
      if (i === date) return
      const avg = sample.reduce((sum, r) => sum + (r[i] ?? '').length, 0) / Math.max(sample.length, 1)
      const numeric = sample.every((r) => parseAmount(r[i] ?? '', 'tr') !== null || !(r[i] ?? '').trim())
      if (!numeric && avg > bestLen) {
        bestLen = avg
        description = i
      }
    })
  }
  const split = amount === NO_COLUMN && debit !== NO_COLUMN && credit !== NO_COLUMN
  let single = amount
  if (!split && single === NO_COLUMN) {
    single = header.findIndex(
      (_, i) =>
        i !== date &&
        i !== description &&
        kinds[i] !== 'balance' &&
        sample.length > 0 &&
        sample.every((r) => parseAmount(r[i] ?? '', 'tr') !== null || parseAmount(r[i] ?? '', 'en') !== null),
    )
  }
  return {
    date,
    description,
    amountMode: split ? 'split' : 'single',
    amount: split ? NO_COLUMN : single,
    debit: split ? debit : NO_COLUMN,
    credit: split ? credit : NO_COLUMN,
  }
}

export interface FormatGuess {
  dateFormat: DateFormat | null
  decimalFormat: DecimalFormat
}

export function guessFormats(rows: readonly (readonly string[])[], mapping: ColumnMapping): FormatGuess {
  const dateFormat = mapping.date === NO_COLUMN ? null : detectDateFormat(rows.map((r) => r[mapping.date] ?? ''))
  const amountCols = mapping.amountMode === 'split' ? [mapping.debit, mapping.credit] : [mapping.amount]
  const samples = rows.flatMap((r) => amountCols.map((c) => (c === NO_COLUMN ? '' : (r[c] ?? ''))))
  return { dateFormat, decimalFormat: detectDecimalFormat(samples) }
}
