import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { ensureSeeded } from '../db/repo'
import type { Account, Budget, FxRate, ImportRecord, Rule, SubscriptionDecision, Transaction } from '../domain/types'
import { withTry } from '../lib/analytics'
import { toIsoDate } from '../lib/dates'
import { toRateTable } from '../lib/fx'
import { detectRecurring } from '../lib/recurrence'
import { sortRules } from '../lib/rules'
import { DataContext, type AppData } from './data'

interface Tables {
  accounts: Account[]
  transactions: Transaction[]
  rules: Rule[]
  budgets: Budget[]
  decisions: SubscriptionDecision[]
  fxRates: FxRate[]
  imports: ImportRecord[]
}

type TableKey = keyof Tables

const SOURCES: { [K in TableKey]: () => Promise<Tables[K]> } = {
  accounts: () => db.accounts.toArray(),
  transactions: () => db.transactions.toArray(),
  rules: () => db.rules.toArray(),
  budgets: () => db.budgets.toArray(),
  decisions: () => db.subscriptionDecisions.toArray(),
  fxRates: () => db.fxRates.toArray(),
  imports: () => db.imports.toArray(),
}

const EMPTY: Tables = { accounts: [], transactions: [], rules: [], budgets: [], decisions: [], fxRates: [], imports: [] }

/**
 * Subscribes to every table with Dexie's liveQuery. Any write anywhere in
 * the app (or in another tab) flows back here and re-renders the consumers,
 * so pages never manage their own copies of the data.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<Tables>(EMPTY)
  const [loaded, setLoaded] = useState<ReadonlySet<TableKey>>(new Set())
  const [today] = useState(() => toIsoDate(new Date()))

  useEffect(() => {
    let cancelled = false
    const subscriptions: { unsubscribe: () => void }[] = []
    void ensureSeeded().then(() => {
      if (cancelled) return
      for (const key of Object.keys(SOURCES) as TableKey[]) {
        const sub = liveQuery<Tables[typeof key]>(() => SOURCES[key]()).subscribe({
          next: (rows) => {
            setTables((prev) => ({ ...prev, [key]: rows }))
            setLoaded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
          },
          error: (error: unknown) => console.error(`liveQuery(${key}) failed`, error),
        })
        subscriptions.push(sub)
      }
    })
    return () => {
      cancelled = true
      for (const s of subscriptions) s.unsubscribe()
    }
  }, [])

  const ready = loaded.size === Object.keys(SOURCES).length
  const rules = useMemo(() => sortRules(tables.rules), [tables.rules])
  const rateTable = useMemo(() => toRateTable(tables.fxRates), [tables.fxRates])
  const txTry = useMemo(() => withTry(tables.transactions, rateTable), [tables.transactions, rateTable])
  const recurring = useMemo(() => detectRecurring(tables.transactions, today), [tables.transactions, today])
  const accountsById = useMemo(() => new Map(tables.accounts.map((a) => [a.id, a])), [tables.accounts])
  const decisions = useMemo(() => new Map(tables.decisions.map((d) => [d.key, d])), [tables.decisions])

  const value = useMemo<AppData>(
    () => ({
      ready,
      today,
      accounts: tables.accounts,
      accountsById,
      transactions: tables.transactions,
      txTry,
      rules,
      budgets: tables.budgets,
      decisions,
      fxRates: [...tables.fxRates].sort((a, b) => b.month.localeCompare(a.month)),
      rateTable,
      imports: tables.imports,
      recurring,
    }),
    [ready, today, tables, accountsById, txTry, rules, decisions, rateTable, recurring],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
