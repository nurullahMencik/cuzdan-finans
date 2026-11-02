import { useMemo } from 'react'
import { useI18n } from '../../i18n/context'
import type { TxTry } from '../../lib/analytics'

export interface TxRow extends TxTry {
  accountName: string
  categoryLabel: string
}

/** Adds display fields used for sorting (category label follows the UI language). */
export function useTxRows(transactions: readonly TxTry[], accountNames: ReadonlyMap<string, string>): TxRow[] {
  const { t } = useI18n()
  return useMemo(
    () =>
      transactions.map((tx) => ({
        ...tx,
        accountName: accountNames.get(tx.accountId) ?? '—',
        categoryLabel: t(`category.${tx.categoryId}`),
      })),
    [transactions, accountNames, t],
  )
}
