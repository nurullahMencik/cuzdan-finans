import Dexie, { type EntityTable } from 'dexie'
import type { Account, Budget, FxRate, ImportRecord, Rule, SubscriptionDecision, Transaction } from '../domain/types'

export interface MetaEntry {
  key: string
  value: string
}

/**
 * Everything lives in the browser's IndexedDB. There is no server and no
 * network call: statements never leave the device.
 */
export type CuzdanDatabase = Dexie & {
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  rules: EntityTable<Rule, 'id'>
  budgets: EntityTable<Budget, 'categoryId'>
  subscriptionDecisions: EntityTable<SubscriptionDecision, 'key'>
  fxRates: EntityTable<FxRate, 'month'>
  imports: EntityTable<ImportRecord, 'id'>
  meta: EntityTable<MetaEntry, 'key'>
}

export const db = new Dexie('cuzdan-finans') as CuzdanDatabase

db.version(1).stores({
  accounts: 'id',
  transactions: 'id, accountId, date, hash, categoryId, merchantKey, importId',
  rules: 'id, priority',
  budgets: 'categoryId',
  subscriptionDecisions: 'key',
  fxRates: 'month',
  imports: 'id, importedAt',
  meta: 'key',
})
