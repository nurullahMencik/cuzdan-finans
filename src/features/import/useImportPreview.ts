import { useMemo } from 'react'
import { useData } from '../../app/data'
import type { Transaction } from '../../domain/types'
import { buildRows, markDuplicates, type RowError } from '../../lib/csv/build'
import type { DateFormat, DecimalFormat } from '../../lib/csv/formats'
import { NO_COLUMN, type ColumnMapping } from '../../lib/csv/structure'
import { normalizeMerchant } from '../../lib/merchant'
import { categorize } from '../../lib/rules'

export type PreviewItem =
  | { status: 'new' | 'duplicate'; line: number; tx: Omit<Transaction, 'id' | 'importId'> }
  | { status: 'error'; line: number; reason: RowError['reason']; raw: string }

export function mappingComplete(m: ColumnMapping): boolean {
  if (m.date === NO_COLUMN || m.description === NO_COLUMN) return false
  return m.amountMode === 'single' ? m.amount !== NO_COLUMN : m.debit !== NO_COLUMN && m.credit !== NO_COLUMN
}

/**
 * Turns raw rows into categorised, de-duplicated transactions for the
 * target account, exactly as they would be saved.
 */
export function useImportPreview(
  dataRows: readonly (readonly string[])[],
  mapping: ColumnMapping,
  dateFormat: DateFormat | null,
  decimalFormat: DecimalFormat,
  accountId: string,
): PreviewItem[] | null {
  const { transactions, rules, accountsById } = useData()
  return useMemo(() => {
    const account = accountsById.get(accountId)
    if (!account || !dateFormat || !mappingComplete(mapping)) return null
    const built = buildRows(dataRows, { mapping, dateFormat, decimalFormat })
    const existing = transactions.filter((t) => t.accountId === accountId).map((t) => t.hash)
    const marked = markDuplicates(built.rows, existing)
    const items: PreviewItem[] = marked.map(({ row, duplicate }) => {
      const merchant = normalizeMerchant(row.description)
      const base = { description: row.description, merchant: merchant.name, amount: row.amount }
      const category = categorize(base, rules)
      return {
        status: duplicate ? 'duplicate' : 'new',
        line: row.line,
        tx: {
          accountId,
          date: row.date,
          description: row.description,
          merchant: merchant.name,
          merchantKey: merchant.key,
          amount: row.amount,
          currency: account.currency,
          categoryId: category.categoryId,
          categorySource: category.categorySource,
          ...(category.ruleId ? { ruleId: category.ruleId } : {}),
          hash: row.hash,
        },
      }
    })
    for (const e of built.errors) items.push({ status: 'error', line: e.line, reason: e.reason, raw: e.raw })
    return items.sort((a, b) => a.line - b.line)
  }, [dataRows, mapping, dateFormat, decimalFormat, accountId, accountsById, transactions, rules])
}
