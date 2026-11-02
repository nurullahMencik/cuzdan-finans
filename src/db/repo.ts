import type { Account, Budget, CategoryId, FxRate, ImportRecord, Rule, SubscriptionStatus, Transaction } from '../domain/types'
import { recategorizeAll, sortRules } from '../lib/rules'
import { db } from './db'

const SEED_KEY = 'seededAt'

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

async function loadSampleData() {
  const { generateSampleData } = await import('../lib/seed/generate')
  return generateSampleData(new Date())
}

let seeding: Promise<void> | null = null

/** Seeds the sample data on the very first visit (once per browser). */
export function ensureSeeded(): Promise<void> {
  seeding ??= (async () => {
    const seeded = await db.meta.get(SEED_KEY)
    if (seeded) return
    const accounts = await db.accounts.count()
    if (accounts > 0) return
    await writeSampleData()
  })()
  return seeding
}

async function writeSampleData(): Promise<void> {
  const data = await loadSampleData()
  await db.transaction('rw', [db.accounts, db.transactions, db.rules, db.budgets, db.fxRates, db.meta], async () => {
    await db.accounts.bulkPut(data.accounts)
    await db.transactions.bulkPut(data.transactions)
    await db.rules.bulkPut(data.rules)
    await db.budgets.bulkPut(data.budgets)
    await db.fxRates.bulkPut(data.fxRates)
    await db.meta.put({ key: SEED_KEY, value: new Date().toISOString() })
  })
}

const ALL_TABLES = () => [
  db.accounts,
  db.transactions,
  db.rules,
  db.budgets,
  db.subscriptionDecisions,
  db.fxRates,
  db.imports,
  db.meta,
]

/** Replaces everything with freshly generated sample data for today. */
export async function resetToSampleData(): Promise<void> {
  const data = await loadSampleData()
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()))
    await db.accounts.bulkPut(data.accounts)
    await db.transactions.bulkPut(data.transactions)
    await db.rules.bulkPut(data.rules)
    await db.budgets.bulkPut(data.budgets)
    await db.fxRates.bulkPut(data.fxRates)
    await db.meta.put({ key: SEED_KEY, value: new Date().toISOString() })
  })
}

/** Deletes all data but remembers that the user opted out of sample data. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()))
    await db.meta.put({ key: SEED_KEY, value: 'cleared' })
  })
}

// ---- Transactions ----------------------------------------------------------

export async function setTransactionCategory(ids: readonly string[], categoryId: CategoryId): Promise<void> {
  await db.transactions.where('id').anyOf([...ids]).modify({ categoryId, categorySource: 'manual', ruleId: undefined })
}

export async function addTransactions(transactions: readonly Transaction[], record: ImportRecord): Promise<void> {
  await db.transaction('rw', [db.transactions, db.imports], async () => {
    await db.transactions.bulkAdd([...transactions])
    await db.imports.add(record)
  })
}

// ---- Rules -------------------------------------------------------------------

/** Re-runs every rule over every non-manual transaction. Returns the change count. */
export async function applyRules(): Promise<number> {
  return db.transaction('rw', [db.transactions, db.rules], async () => {
    const [rules, transactions] = await Promise.all([db.rules.toArray(), db.transactions.toArray()])
    const changed = recategorizeAll(transactions, rules)
    if (changed.length > 0) await db.transactions.bulkPut(changed)
    return changed.length
  })
}

export async function saveRule(rule: Omit<Rule, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<number> {
  const full: Rule = { ...rule, id: rule.id ?? newId('rule'), createdAt: rule.createdAt ?? new Date().toISOString() }
  await db.rules.put(full)
  return applyRules()
}

/** Inserts a learned rule above all others and applies it. */
export async function saveLearnedRule(rule: Omit<Rule, 'id' | 'createdAt' | 'priority'>): Promise<number> {
  const rules = sortRules(await db.rules.toArray())
  const top = rules.length > 0 ? (rules[0]?.priority ?? 0) - 1 : 0
  return saveRule({ ...rule, priority: top })
}

export async function deleteRule(id: string): Promise<number> {
  await db.rules.delete(id)
  return applyRules()
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<number> {
  await db.rules.update(id, { enabled })
  return applyRules()
}

export async function saveRuleOrder(orderedIds: readonly string[]): Promise<number> {
  await db.transaction('rw', db.rules, async () => {
    await Promise.all(orderedIds.map((id, priority) => db.rules.update(id, { priority })))
  })
  return applyRules()
}

// ---- Budgets, subscriptions, accounts, FX -----------------------------------------

export async function saveBudget(budget: Budget): Promise<void> {
  await db.budgets.put(budget)
}

export async function deleteBudget(categoryId: CategoryId): Promise<void> {
  await db.budgets.delete(categoryId)
}

export async function decideSubscription(key: string, status: SubscriptionStatus | null): Promise<void> {
  if (status === null) await db.subscriptionDecisions.delete(key)
  else await db.subscriptionDecisions.put({ key, status, decidedAt: new Date().toISOString() })
}

export async function saveAccount(account: Account): Promise<void> {
  await db.accounts.put(account)
}

export async function saveFxRate(rate: FxRate): Promise<void> {
  await db.fxRates.put(rate)
}
