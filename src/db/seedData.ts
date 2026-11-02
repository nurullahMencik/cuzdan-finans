import { generateSampleData } from '../lib/seed/generate'
import { db, SEED_KEY } from './db'

/** Generates the sample data for `today` and writes it in one transaction. */
export async function writeSampleData(today: Date, options: { clearFirst?: boolean } = {}): Promise<void> {
  const data = generateSampleData(today)
  const tables = [db.accounts, db.transactions, db.rules, db.budgets, db.subscriptionDecisions, db.fxRates, db.imports, db.meta]
  await db.transaction('rw', tables, async () => {
    if (options.clearFirst) await Promise.all(tables.map((t) => t.clear()))
    await db.accounts.bulkPut(data.accounts)
    await db.transactions.bulkPut(data.transactions)
    await db.rules.bulkPut(data.rules)
    await db.budgets.bulkPut(data.budgets)
    await db.fxRates.bulkPut(data.fxRates)
    await db.meta.put({ key: SEED_KEY, value: today.toISOString() })
  })
}
