import { createContext, useContext } from 'react'
import type { Account, Budget, FxRate, ImportRecord, Rule, SubscriptionDecision, Transaction } from '../domain/types'
import type { TxTry } from '../lib/analytics'
import type { RateTable } from '../lib/fx'
import type { RecurringSeries } from '../lib/recurrence'

export interface AppData {
  ready: boolean
  /** Local calendar date when the app was opened (yyyy-MM-dd). */
  today: string
  accounts: Account[]
  accountsById: ReadonlyMap<string, Account>
  transactions: Transaction[]
  /** Transactions with `amountTry`, converted with the monthly FX table. */
  txTry: TxTry[]
  /** Sorted by priority. */
  rules: Rule[]
  budgets: Budget[]
  decisions: ReadonlyMap<string, SubscriptionDecision>
  fxRates: FxRate[]
  rateTable: RateTable
  imports: ImportRecord[]
  recurring: RecurringSeries[]
}

export const DataContext = createContext<AppData | null>(null)

export function useData(): AppData {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
