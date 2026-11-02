import type { CategoryId, CurrencyCode, Transaction } from '../domain/types'
import { addDays, addMonthsToDate, diffDays, toDayNumber } from './dates'

export type Period = 'weekly' | 'monthly' | 'yearly'

interface PeriodSpec {
  period: Period
  /** Nominal interval in days. */
  days: number
  /** Allowed deviation of a single gap, in days. */
  tolerance: number
  minOccurrences: number
  perYear: number
  /** Occurrence count at which support saturates. */
  idealOccurrences: number
}

export const PERIOD_SPECS: readonly PeriodSpec[] = [
  { period: 'weekly', days: 7, tolerance: 1.5, minOccurrences: 5, perYear: 52, idealOccurrences: 10 },
  { period: 'monthly', days: 30.44, tolerance: 5, minOccurrences: 3, perYear: 12, idealOccurrences: 6 },
  { period: 'yearly', days: 365.25, tolerance: 20, minOccurrences: 2, perYear: 1, idealOccurrences: 3 },
]

/** ±15%: subscriptions drift (price rises, FX) but stay in a narrow band. */
export const AMOUNT_TOLERANCE = 0.15
const MAX_SKIPS = 1
export const MIN_CONFIDENCE = 0.5

export type RecurrenceInput = Pick<
  Transaction,
  'id' | 'date' | 'amount' | 'merchant' | 'merchantKey' | 'currency' | 'categoryId' | 'accountId'
>

export interface RecurringSeries {
  key: string
  merchant: string
  merchantKey: string
  categoryId: CategoryId
  accountId: string
  currency: CurrencyCode
  period: Period
  /** Average of the latest three charges, positive, in account currency. */
  averageAmount: number
  annualCost: number
  occurrences: number
  skipped: number
  firstDate: string
  lastDate: string
  nextDate: string
  /** 0..1 */
  confidence: number
  status: 'active' | 'lapsed'
  transactionIds: string[]
  history: { date: string; amount: number }[]
}

/**
 * Groups charges by merchant, then by amount (each charge joins the cluster
 * whose latest amount is within ±15%, so gradual price rises stay in one
 * series), then tests each cluster against weekly / monthly / yearly
 * cadences. A gap may span two periods once (one missed payment).
 */
export function detectRecurring(transactions: readonly RecurrenceInput[], today: string): RecurringSeries[] {
  const groups = new Map<string, RecurrenceInput[]>()
  for (const tx of transactions) {
    if (tx.amount >= 0 || tx.categoryId === 'transfer' || tx.date > today) continue
    const key = `${tx.merchantKey}|${tx.currency}`
    const list = groups.get(key)
    if (list) list.push(tx)
    else groups.set(key, [tx])
  }

  const found: RecurringSeries[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    for (const cluster of clusterByAmount(list)) {
      const series = evaluateCluster(cluster, list, today)
      if (series) found.push(series)
    }
  }

  // Keys must be unique for persisted confirm/ignore decisions.
  const seen = new Map<string, number>()
  for (const s of found) {
    const n = (seen.get(s.key) ?? 0) + 1
    seen.set(s.key, n)
    if (n > 1) s.key = `${s.key}|${n}`
  }
  return found.sort((a, b) => b.annualCost - a.annualCost)
}

export function clusterByAmount<T extends { amount: number }>(sortedByDate: readonly T[]): T[][] {
  const clusters: { last: number; items: T[] }[] = []
  for (const tx of sortedByDate) {
    const abs = Math.abs(tx.amount)
    let best: { last: number; items: T[] } | null = null
    let bestDiff = Infinity
    for (const c of clusters) {
      const diff = Math.abs(abs - c.last) / c.last
      if (diff <= AMOUNT_TOLERANCE && diff < bestDiff) {
        best = c
        bestDiff = diff
      }
    }
    if (best) {
      best.items.push(tx)
      best.last = abs
    } else {
      clusters.push({ last: abs, items: [tx] })
    }
  }
  return clusters.map((c) => c.items)
}

interface GapFit {
  valid: boolean
  periods: number
  deviation: number
}

function fitGap(gap: number, spec: PeriodSpec): GapFit {
  const periods = Math.round(gap / spec.days)
  if (periods < 1 || periods > 1 + MAX_SKIPS) return { valid: false, periods, deviation: Infinity }
  const deviation = Math.abs(gap - periods * spec.days)
  const allowed = spec.tolerance * (periods === 1 ? 1 : 1.5)
  return { valid: deviation <= allowed, periods, deviation: deviation / allowed }
}

function evaluateCluster(
  cluster: readonly RecurrenceInput[],
  merchantCharges: readonly RecurrenceInput[],
  today: string,
): RecurringSeries | null {
  if (cluster.length < 2) return null
  let best: { series: RecurringSeries; score: number } | null = null
  for (const spec of PERIOD_SPECS) {
    const series = evaluateWithSpec(cluster, merchantCharges, spec, today)
    if (series && (!best || series.confidence > best.score)) best = { series, score: series.confidence }
  }
  return best?.series ?? null
}

function evaluateWithSpec(
  cluster: readonly RecurrenceInput[],
  merchantCharges: readonly RecurrenceInput[],
  spec: PeriodSpec,
  today: string,
): RecurringSeries | null {
  // Global consistency: most gaps in the whole cluster must fit the cadence.
  const gaps: GapFit[] = []
  for (let i = 1; i < cluster.length; i++) {
    const a = cluster[i - 1]
    const b = cluster[i]
    if (a && b) gaps.push(fitGap(diffDays(b.date, a.date), spec))
  }
  const fitRatio = gaps.filter((g) => g.valid).length / gaps.length
  if (fitRatio < 0.6) return null

  // The current run: walk back from the latest charge while gaps fit.
  let start = cluster.length - 1
  let skipped = 0
  const deviations: number[] = []
  for (let i = gaps.length - 1; i >= 0; i--) {
    const gap = gaps[i]
    if (!gap?.valid) break
    const extra = gap.periods - 1
    if (skipped + extra > MAX_SKIPS) break
    skipped += extra
    deviations.push(gap.deviation)
    start = i
  }
  const run = cluster.slice(start)
  if (run.length < spec.minOccurrences) return null

  const amounts = run.map((t) => Math.abs(t.amount))
  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length
  const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1

  const regularity = 1 - 0.5 * (deviations.reduce((s, v) => s + v, 0) / Math.max(deviations.length, 1))
  const stability = 1 - 0.5 * Math.min(1, cv / AMOUNT_TOLERANCE)
  const support = Math.min(1, run.length / spec.idealOccurrences)
  const last = run[run.length - 1]
  const first = run[0]
  if (!last || !first) return null

  // Noise: other charges from the same merchant inside the run's time span.
  // A real subscription stands alone; a supermarket visited every few days
  // can produce a regular-looking subsequence by pure chance.
  const runIds = new Set(run.map((t) => t.id))
  const others = merchantCharges.filter((t) => !runIds.has(t.id) && t.date >= first.date && t.date <= last.date).length
  const noisePenalty = 0.25 * Math.min(2, others / run.length)

  let confidence = 0.4 * regularity + 0.3 * stability + 0.3 * support - 0.1 * skipped - noisePenalty
  const nextDate = nextOccurrence(run, spec)
  const overdueBy = diffDays(today, nextDate)
  // Overdue, yet the merchant did charge around the expected date with an
  // amount outside the band: a bill whose amount moved (seasonal gas, a big
  // price rise). The old amount cluster is stale rather than cancelled.
  if (overdueBy > spec.tolerance) {
    const continued = merchantCharges.some(
      (t) => !runIds.has(t.id) && t.date > last.date && Math.abs(diffDays(t.date, nextDate)) <= spec.tolerance,
    )
    if (continued) return null
  }
  const lapsed = overdueBy > spec.tolerance + spec.days * 0.5
  if (lapsed) confidence *= 0.75
  confidence = Math.max(0, Math.min(1, confidence))
  if (confidence < MIN_CONFIDENCE) return null

  const recent = amounts.slice(-3)
  const averageAmount = round2(recent.reduce((s, v) => s + v, 0) / recent.length)
  return {
    key: `${last.merchantKey}|${last.currency}|${spec.period}`,
    merchant: last.merchant,
    merchantKey: last.merchantKey,
    categoryId: last.categoryId,
    accountId: last.accountId,
    currency: last.currency,
    period: spec.period,
    averageAmount,
    annualCost: round2(averageAmount * spec.perYear),
    occurrences: run.length,
    skipped,
    firstDate: first.date,
    lastDate: last.date,
    nextDate,
    confidence: Math.round(confidence * 100) / 100,
    status: lapsed ? 'lapsed' : 'active',
    transactionIds: run.map((t) => t.id),
    history: run.map((t) => ({ date: t.date, amount: Math.abs(t.amount) })),
  }
}

function nextOccurrence(run: readonly RecurrenceInput[], spec: PeriodSpec): string {
  const last = run[run.length - 1]
  if (!last) return ''
  switch (spec.period) {
    case 'weekly':
      return addDays(last.date, 7)
    case 'monthly': {
      // Billing day = most common day of month, so a weekend shift does not stick.
      const days = run.map((t) => Number(t.date.slice(8, 10)))
      return addMonthsToDate(last.date, 1, mode(days))
    }
    case 'yearly':
      return addMonthsToDate(last.date, 12)
  }
}

function mode(values: readonly number[]): number {
  const counts = new Map<number, number>()
  let best = values[values.length - 1] ?? 1
  let bestCount = 0
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1
    counts.set(v, c)
    if (c > bestCount || (c === bestCount && v > best)) {
      best = v
      bestCount = c
    }
  }
  return best
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Monthly-equivalent cost, used for totals across mixed cadences. */
export function monthlyEquivalent(series: Pick<RecurringSeries, 'annualCost'>): number {
  return series.annualCost / 12
}

export function daysUntil(dateIso: string, today: string): number {
  return toDayNumber(dateIso) - toDayNumber(today)
}
