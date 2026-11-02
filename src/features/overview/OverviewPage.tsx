import { FileUp, Inbox, RotateCcw } from 'lucide-react'
import { lazy, useMemo } from 'react'
import { useData } from '../../app/data'
import { useMonth } from '../../app/month'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { Button, ButtonLink, EmptyState, PageHeader } from '../../components/ui'
import { resetToSampleData } from '../../db/repo'
import { categoryColorVar, getCategory } from '../../domain/categories'
import { useI18n } from '../../i18n/context'
import { change, cumulativeDailyExpense, expenseByCategory, monthlySeries, totalsFor } from '../../lib/analytics'
import { addMonthsToMonth, daysInMonth, diffDays, monthRange } from '../../lib/dates'
import { rateFor } from '../../lib/fx'
import { computeBudgetRows, STATUS_ORDER } from '../budgets/compute'
import { BudgetAlerts } from './BudgetAlerts'
import { ChartFrame, DataTable, LegendItem } from './charts/ChartFrame'
import type { DonutSlice } from './charts/CategoryDonut'
import { KpiTile, type KpiDelta } from './KpiTile'
import { UpcomingPayments, type UpcomingItem } from './UpcomingPayments'

const CashflowChart = lazy(() => import('./charts/CashflowChart'))
const CategoryDonut = lazy(() => import('./charts/CategoryDonut'))
const SpendingTrend = lazy(() => import('./charts/SpendingTrend'))

const DONUT_SLICES = 5

export function OverviewPage() {
  const { t, f } = useI18n()
  const { ready, txTry, transactions, budgets, recurring, decisions, today, rateTable } = useData()
  const { month, setMonth, isCurrent, throughDay } = useMonth()
  const prevMonth = addMonthsToMonth(month, -1)

  const kpis = useMemo(() => {
    const current = totalsFor(txTry, month)
    // A month in progress is compared with the same days of last month.
    const previous = totalsFor(txTry, prevMonth, isCurrent ? throughDay : undefined)
    const series = monthlySeries(txTry, monthRange(month, 12))
    return { current, previous, series }
  }, [txTry, month, prevMonth, isCurrent, throughDay])

  const categories = useMemo(() => expenseByCategory(txTry, month), [txTry, month])

  const donut = useMemo(() => {
    const total = categories.reduce((s, c) => s + c.amount, 0)
    // Only categories that own a palette slot get their own slice; the rest fold into "Other".
    const slotted = categories.filter((c) => getCategory(c.categoryId).slot !== null)
    const top = slotted.slice(0, DONUT_SLICES)
    const restAmount = total - top.reduce((s, c) => s + c.amount, 0)
    const slices: DonutSlice[] = top.map((c) => ({
      key: c.categoryId,
      label: t(`category.${c.categoryId}`),
      value: c.amount,
      share: total > 0 ? c.amount / total : 0,
      color: categoryColorVar(c.categoryId),
    }))
    if (restAmount > 0.5) {
      slices.push({ key: 'rest', label: t('chart.categories.others'), value: restAmount, share: restAmount / total, color: 'var(--other)' })
    }
    return { total, slices }
  }, [categories, t])

  const trend = useMemo(() => {
    const current = cumulativeDailyExpense(txTry, month)
    const previous = cumulativeDailyExpense(txTry, prevMonth)
    const days = daysInMonth(month)
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      current: i < throughDay ? (current[i] ?? null) : null,
      previous: previous[i] ?? previous[previous.length - 1] ?? null,
    }))
  }, [txTry, month, prevMonth, throughDay])

  const budgetRows = useMemo(
    () => computeBudgetRows(txTry, budgets, month, throughDay).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [txTry, budgets, month, throughDay],
  )

  const upcoming = useMemo<UpcomingItem[]>(
    () =>
      recurring
        .filter((s) => s.status === 'active' && decisions.get(s.key)?.status !== 'ignored')
        .map((series) => ({
          series,
          daysLeft: diffDays(series.nextDate, today),
          amountTry: series.averageAmount * rateFor(series.currency, today.slice(0, 7), rateTable),
        }))
        .filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [recurring, decisions, today, rateTable],
  )

  const monthName = f.month(month)
  const subtitle = isCurrent
    ? `${t('overview.subtitle', { month: monthName })} · ${t('month.partial', { day: throughDay, month: f.monthShort(month) })}`
    : t('overview.subtitle', { month: monthName })
  const header = <PageHeader title={t('overview.title')} subtitle={subtitle} actions={<MonthSwitcher />} />

  if (!ready) {
    return (
      <>
        {header}
        <OverviewSkeleton />
      </>
    )
  }
  if (transactions.length === 0) return <EmptyOverview />

  const { current, previous, series } = kpis
  const caption = isCurrent ? t('kpi.vsPreviousPartial') : t('kpi.vsPrevious')
  const pctDelta = (now: number, before: number, upIsGood: boolean): KpiDelta | null => {
    const ratio = change(now, before)
    if (ratio === null) return null
    const direction = Math.abs(ratio) < 0.005 ? 'flat' : ratio > 0 ? 'up' : 'down'
    return {
      text: f.percent(ratio, { signed: true, decimals: Math.abs(ratio) < 0.1 ? 1 : 0 }),
      direction,
      good: direction === 'flat' ? null : (direction === 'up') === upIsGood,
      caption,
    }
  }
  const netDiff = current.net - previous.net
  const netDelta: KpiDelta | null =
    previous.income === 0 && previous.expense === 0
      ? null
      : {
          text: f.money(netDiff, 'TRY', { signed: true, decimals: 0 }),
          direction: Math.abs(netDiff) < 1 ? 'flat' : netDiff > 0 ? 'up' : 'down',
          good: Math.abs(netDiff) < 1 ? null : netDiff > 0,
          caption,
        }
  const rateDiff = current.savingsRate !== null && previous.savingsRate !== null ? (current.savingsRate - previous.savingsRate) * 100 : null
  const rateDelta: KpiDelta | null =
    rateDiff === null
      ? null
      : {
          text: t('kpi.points', { value: `${rateDiff > 0 ? '+' : rateDiff < 0 ? '−' : ''}${f.number(Math.abs(rateDiff), 1)}` }),
          direction: Math.abs(rateDiff) < 0.05 ? 'flat' : rateDiff > 0 ? 'up' : 'down',
          good: Math.abs(rateDiff) < 0.05 ? null : rateDiff > 0,
          caption,
        }

  const cashflow = series.map((m) => ({ ...m, label: f.monthShort(m.month) }))

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          label={t('kpi.income')}
          value={f.money(current.income, 'TRY', { decimals: 0 })}
          delta={pctDelta(current.income, previous.income, true)}
          noDeltaText={t('kpi.noComparison')}
          trend={series.map((s) => s.income)}
          trendLabel={`${t('kpi.income')} · ${t('kpi.trend')}`}
        />
        <KpiTile
          label={t('kpi.expense')}
          value={f.money(current.expense, 'TRY', { decimals: 0 })}
          delta={pctDelta(current.expense, previous.expense, false)}
          noDeltaText={t('kpi.noComparison')}
          trend={series.map((s) => s.expense)}
          trendLabel={`${t('kpi.expense')} · ${t('kpi.trend')}`}
        />
        <KpiTile
          label={t('kpi.net')}
          value={f.money(current.net, 'TRY', { decimals: 0 })}
          delta={netDelta}
          noDeltaText={t('kpi.noComparison')}
          trend={series.map((s) => s.net)}
          trendLabel={`${t('kpi.net')} · ${t('kpi.trend')}`}
        />
        <KpiTile
          label={t('kpi.savingsRate')}
          value={current.savingsRate === null ? '–' : f.percent(current.savingsRate, { decimals: 1 })}
          delta={rateDelta}
          noDeltaText={t('kpi.noComparison')}
          trend={series.map((s) => s.savingsRate ?? 0)}
          trendLabel={`${t('kpi.savingsRate')} · ${t('kpi.trend')}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartFrame
          className="lg:col-span-2"
          title={t('chart.cashflow.title')}
          subtitle={t('chart.cashflow.subtitle')}
          height={330}
          legend={
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <LegendItem color="var(--income)" label={t('chart.cashflow.income')} />
              <LegendItem color="var(--expense)" label={t('chart.cashflow.expense')} />
              <LegendItem color="var(--ink)" label={t('chart.cashflow.net')} shape="line" />
            </div>
          }
          chart={<CashflowChart data={cashflow} selected={month} onSelect={setMonth} />}
          table={
            <DataTable
              head={[t('common.month'), t('chart.cashflow.income'), t('chart.cashflow.expense'), t('chart.cashflow.net')]}
              rows={cashflow.map((m) => [
                f.month(m.month),
                f.money(m.income, 'TRY', { decimals: 0 }),
                f.money(m.expense, 'TRY', { decimals: 0 }),
                f.money(m.net, 'TRY', { decimals: 0, signed: true }),
              ])}
            />
          }
        />

        <ChartFrame
          title={t('chart.categories.title')}
          subtitle={`${t('chart.categories.subtitle')} · ${monthName}`}
          height={200}
          chart={
            donut.total > 0 ? (
              <CategoryDonut data={donut.slices} total={donut.total} />
            ) : (
              <EmptyState icon={Inbox}>{t('chart.categories.empty')}</EmptyState>
            )
          }
          table={
            <DataTable
              head={[t('tx.col.category'), t('tx.col.amount'), '%']}
              rows={categories.map((c) => [
                t(`category.${c.categoryId}`),
                f.money(c.amount, 'TRY', { decimals: 0 }),
                f.percent(c.amount / donut.total, { decimals: 1 }),
              ])}
            />
          }
          footer={
            donut.total > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {donut.slices.map((slice) => (
                  <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-ink-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
                      <span className="truncate">{slice.label}</span>
                    </span>
                    <span className="tnum shrink-0">
                      <span className="font-semibold text-ink">{f.money(slice.value, 'TRY', { decimals: 0 })}</span>
                      <span className="ml-2 inline-block w-9 text-right text-xs text-ink-3">{f.percent(slice.share)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        />

        <ChartFrame
          className="lg:col-span-2"
          title={t('chart.trend.title')}
          subtitle={t('chart.trend.subtitle')}
          height={300}
          legend={
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <LegendItem color="var(--series-1)" label={monthName} shape="line" />
              <LegendItem color="var(--ink-3)" label={f.month(prevMonth)} shape="line" />
            </div>
          }
          chart={<SpendingTrend data={trend} currentLabel={monthName} previousLabel={f.month(prevMonth)} />}
          table={
            <DataTable
              head={[t('chart.trend.dayAxis'), monthName, f.month(prevMonth)]}
              rows={trend
                .filter((p) => p.day % 5 === 0 || p.day === 1 || p.day === trend.length)
                .map((p) => [
                  t('chart.trend.day', { day: p.day }),
                  p.current === null ? '–' : f.money(p.current, 'TRY', { decimals: 0 }),
                  p.previous === null ? '–' : f.money(p.previous, 'TRY', { decimals: 0 }),
                ])}
            />
          }
        />

        <UpcomingPayments items={upcoming} />
      </div>

      <BudgetAlerts rows={budgetRows} className="mt-4" />

    </>
  )
}

/** Same footprint as the loaded page, so nothing shifts when data arrives. */
function OverviewSkeleton() {
  const { t } = useI18n()
  return (
    <div role="status" aria-label={t('app.loading')}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-[8.25rem] animate-pulse sm:h-[8.75rem]" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card h-[27rem] animate-pulse lg:col-span-2" />
        <div className="card h-[27rem] animate-pulse" />
      </div>
    </div>
  )
}

function EmptyOverview() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState icon={Inbox} title={t('overview.empty.title')}>
        <p>{t('overview.empty.body')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink to="/import" variant="primary" icon={FileUp}>
            {t('overview.empty.import')}
          </ButtonLink>
          <Button icon={RotateCcw} onClick={() => void resetToSampleData()}>
            {t('overview.empty.sample')}
          </Button>
        </div>
      </EmptyState>
    </div>
  )
}
