import { normalizeForHash } from '../merchant'
import { hashString } from '../text'
import { parseAmount, parseDate, type DateFormat, type DecimalFormat } from './formats'
import { NO_COLUMN, type ColumnMapping } from './structure'

export interface ParsedRow {
  /** 1-based line number in the data section, for error messages. */
  line: number
  date: string
  description: string
  amount: number
  hash: string
}

export type RowError = { line: number; reason: 'date' | 'amount' | 'description' | 'empty'; raw: string }

export interface BuildResult {
  rows: ParsedRow[]
  errors: RowError[]
}

/** Duplicate key: date + amount + description folded to bare letters/digits. */
export function transactionHash(date: string, amount: number, description: string): string {
  return hashString(`${date}|${amount.toFixed(2)}|${normalizeForHash(description)}`)
}

export interface BuildOptions {
  mapping: ColumnMapping
  dateFormat: DateFormat
  decimalFormat: DecimalFormat
}

/**
 * Converts raw data rows (header excluded) into signed transactions.
 * In split mode the amount is credit − debit; banks disagree on whether the
 * debit column carries a minus sign, so absolute values are used for both.
 */
export function buildRows(rows: readonly (readonly string[])[], options: BuildOptions): BuildResult {
  const { mapping, dateFormat, decimalFormat } = options
  const out: ParsedRow[] = []
  const errors: RowError[] = []
  rows.forEach((cells, index) => {
    const line = index + 1
    const raw = cells.join(' | ')
    if (cells.every((c) => !c.trim())) return
    const dateRaw = mapping.date === NO_COLUMN ? '' : (cells[mapping.date] ?? '')
    const date = parseDate(dateRaw, dateFormat)
    if (!date) {
      errors.push({ line, reason: 'date', raw })
      return
    }
    const description = (mapping.description === NO_COLUMN ? '' : (cells[mapping.description] ?? '')).replace(/\s+/g, ' ').trim()
    if (!description) {
      errors.push({ line, reason: 'description', raw })
      return
    }
    let amount: number | null
    if (mapping.amountMode === 'split') {
      const debitRaw = (cells[mapping.debit] ?? '').trim()
      const creditRaw = (cells[mapping.credit] ?? '').trim()
      const debit = debitRaw ? parseAmount(debitRaw, decimalFormat) : 0
      const credit = creditRaw ? parseAmount(creditRaw, decimalFormat) : 0
      amount = debit === null || credit === null || (!debitRaw && !creditRaw) ? null : Math.abs(credit) - Math.abs(debit)
    } else {
      amount = parseAmount(cells[mapping.amount] ?? '', decimalFormat)
    }
    if (amount === null) {
      errors.push({ line, reason: 'amount', raw })
      return
    }
    const rounded = Math.round(amount * 100) / 100
    out.push({ line, date, description, amount: rounded, hash: transactionHash(date, rounded, description) })
  })
  return { rows: out, errors }
}

/**
 * Marks rows that already exist. Counting occurrences (instead of a plain
 * set) keeps two genuine identical purchases on the same day: if the account
 * already holds one "SIMIT SARAYI 45,00" on a date and the file has two,
 * exactly one of them is new.
 */
export function markDuplicates<T extends { hash: string }>(
  rows: readonly T[],
  existingHashes: Iterable<string>,
): { row: T; duplicate: boolean }[] {
  const remaining = new Map<string, number>()
  for (const h of existingHashes) remaining.set(h, (remaining.get(h) ?? 0) + 1)
  return rows.map((row) => {
    const left = remaining.get(row.hash) ?? 0
    if (left > 0) {
      remaining.set(row.hash, left - 1)
      return { row, duplicate: true }
    }
    return { row, duplicate: false }
  })
}
