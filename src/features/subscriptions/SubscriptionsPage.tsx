import { CalendarClock, Check, CircleHelp, Clock, EyeOff, RotateCcw, Undo2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useData } from '../../app/data'
import { useToast } from '../../app/toast'
import { cx } from '../../components/classes'
import { Badge, Button, CategoryLabel, EmptyState, PageHeader } from '../../components/ui'
import { Tabs } from '../../components/Tabs'
import { decideSubscription } from '../../db/repo'
import { categoryColorVar } from '../../domain/categories'
import type { SubscriptionStatus } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { diffDays } from '../../lib/dates'
import { rateFor } from '../../lib/fx'
import type { RecurringSeries } from '../../lib/recurrence'

type Tab = 'suggested' | 'confirmed' | 'ignored'

export function SubscriptionsPage() {
  const { t, f } = useI18n()
  const { recurring, decisions, rateTable, today } = useData()
  const [tab, setTab] = useState<Tab>('suggested')
  const month = today.slice(0, 7)

  const grouped = useMemo(() => {
    const out: Record<Tab, RecurringSeries[]> = { suggested: [], confirmed: [], ignored: [] }
    for (const s of recurring) {
      const status = decisions.get(s.key)?.status
      out[status ?? 'suggested'].push(s)
    }
    for (const list of Object.values(out)) list.sort((a, b) => (a.status === b.status ? b.annualCost - a.annualCost : a.status === 'active' ? -1 : 1))
    return out
  }, [recurring, decisions])

  const toTry = (s: RecurringSeries, amount: number) => amount * rateFor(s.currency, month, rateTable)
  const active = [...grouped.confirmed, ...grouped.suggested].filter((s) => s.status === 'active')
  const yearly = active.reduce((sum, s) => sum + toTry(s, s.annualCost), 0)

  return (
    <>
      <PageHeader title={t('subs.title')} subtitle={t('subs.subtitle')} />

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-label={t('subs.summary.hint')} className="card grid grid-cols-2 content-center gap-5 p-5 sm:grid-cols-3">
          <SummaryStat label={t('subs.summary.monthly')} value={f.money(yearly / 12, 'TRY', { decimals: 0 })} />
          <SummaryStat label={t('subs.summary.yearly')} value={f.money(yearly, 'TRY', { decimals: 0 })} />
          <SummaryStat label={t('subs.summary.active')} value={f.number(active.length)} hint={t('subs.summary.hint')} />
        </section>

        <aside className="card p-5" aria-labelledby="how-title">
          <h2 id="how-title" className="flex items-center gap-2 text-sm font-bold text-ink">
            <CircleHelp aria-hidden className="size-4 text-accent" />
            {t('subs.how.title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{t('subs.how.body')}</p>
        </aside>
      </div>

        <Tabs
          label={t('subs.tabs')}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'suggested', label: t('subs.tab.suggested'), count: grouped.suggested.length },
            { value: 'confirmed', label: t('subs.tab.confirmed'), count: grouped.confirmed.length },
            { value: 'ignored', label: t('subs.tab.ignored'), count: grouped.ignored.length },
          ]}
        >
          {grouped[tab].length === 0 ? (
            <div className="card">
              <EmptyState icon={CalendarClock}>{t(`subs.empty.${tab}`)}</EmptyState>
            </div>
          ) : (
            <>
            <div aria-hidden className="mb-2 hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] gap-x-6 px-5 text-[0.6875rem] font-semibold tracking-wide text-ink-3 uppercase md:grid">
              <span>{t('subs.col.merchant')}</span>
              <span>{t('subs.col.average')}</span>
              <span>{t('subs.col.next')}</span>
              <span>{t('subs.col.annual')}</span>
              <span className="w-[11.5rem]" />
            </div>
            <ul className="flex flex-col gap-3">
              {grouped[tab].map((s) => (
                <SeriesRow key={s.key} series={s} tab={tab} amountTry={toTry(s, s.averageAmount)} today={today} />
              ))}
            </ul>
            </>
          )}
        </Tabs>
    </>
  )
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 hidden text-[0.6875rem] text-ink-3 sm:block">{hint}</p>}
    </div>
  )
}

function SeriesRow({ series: s, tab, amountTry, today }: { series: RecurringSeries; tab: Tab; amountTry: number; today: string }) {
  const { t, f } = useI18n()
  const { notify } = useToast()
  const days = diffDays(s.nextDate, today)
  const overdue = s.status === 'active' && days < 0
  const decide = (status: SubscriptionStatus | null, message: 'subs.confirmed' | 'subs.ignored' | 'subs.restored') =>
    void decideSubscription(s.key, status).then(() => notify({ message: t(message, { merchant: s.merchant }), tone: 'success' }))
  const confidenceTone = s.confidence >= 0.8 ? 'bg-accent' : s.confidence >= 0.65 ? 'bg-ink-3' : 'bg-warning'

  return (
    <li className={cx('card grid gap-x-6 gap-y-3 p-4 sm:p-5 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] md:items-center', s.status === 'lapsed' && 'opacity-80')}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-ink"
          style={{
            background: `color-mix(in oklab, ${categoryColorVar(s.categoryId)} 22%, var(--surface))`,
            boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${categoryColorVar(s.categoryId)} 55%, transparent)`,
          }}
        >
          {s.merchant.charAt(0).toLocaleUpperCase('tr-TR')}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-bold text-ink">{s.merchant}</span>
            <Badge tone="neutral">{t(`period.${s.period}`)}</Badge>
            {s.status === 'lapsed' && (
              <Badge tone="warning" icon={Clock}>
                <span title={t('subs.lapsedHint')}>{t('subs.lapsed')}</span>
              </Badge>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-3">
            <CategoryLabel id={s.categoryId} />
            <span>· {t('subs.history', { count: s.occurrences, first: f.date(s.firstDate, 'MMM yyyy') })}</span>
            {s.skipped > 0 && <span>· {t('subs.skipped', { count: s.skipped })}</span>}
          </p>
        </div>
      </div>

      <dl className="contents">
        <Metric label={t('subs.col.average')}>
          <span className="font-semibold text-ink">{f.money(s.averageAmount, s.currency)}</span>
          {s.currency !== 'TRY' && <span className="block text-xs text-ink-3">≈ {f.money(amountTry)}</span>}
        </Metric>
        <Metric label={t('subs.col.next')}>
          <span className="font-semibold text-ink">{f.date(s.nextDate, 'd MMM yyyy')}</span>
          <span className={cx('block text-xs', overdue ? 'font-semibold text-warning' : 'text-ink-3')}>
            {s.status === 'lapsed'
              ? t('subs.expectedPassed')
              : overdue
                ? `${t('subs.overdue')} · ${t('common.daysAgo', { count: -days })}`
                : days === 0
                  ? t('common.today')
                  : t('common.inDays', { count: days })}
          </span>
        </Metric>
        <Metric label={t('subs.col.annual')}>
          <span className="font-semibold text-ink">{f.money(s.annualCost, s.currency, { decimals: 0 })}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-ink-3">
            <span
              role="meter"
              aria-label={t('subs.col.confidence')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(s.confidence * 100)}
              className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-3"
            >
              <span className={cx('block h-full rounded-full', confidenceTone)} style={{ width: `${s.confidence * 100}%` }} />
            </span>
            {t('subs.col.confidence')} {f.percent(s.confidence)}
          </span>
        </Metric>
      </dl>

      <div className="flex gap-2 md:w-[11.5rem] md:justify-end">
        {tab === 'suggested' && (
          <>
            <Button size="sm" variant="primary" icon={Check} onClick={() => decide('confirmed', 'subs.confirmed')} aria-label={`${t('subs.confirm')}: ${s.merchant}`}>
              {t('subs.confirm')}
            </Button>
            <Button size="sm" variant="ghost" icon={EyeOff} onClick={() => decide('ignored', 'subs.ignored')} aria-label={`${t('subs.ignore')}: ${s.merchant}`}>
              {t('subs.ignore')}
            </Button>
          </>
        )}
        {tab !== 'suggested' && (
          <Button size="sm" variant="ghost" icon={tab === 'ignored' ? RotateCcw : Undo2} onClick={() => decide(null, 'subs.restored')}>
            {t('subs.restore')}
          </Button>
        )}
      </div>
    </li>
  )
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tnum min-w-0 text-sm">
      <dt className="text-[0.6875rem] font-semibold text-ink-3 md:sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
