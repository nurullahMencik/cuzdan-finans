import { ArrowRight, CalendarCheck } from 'lucide-react'
import { Link } from 'react-router'
import { CategoryDot } from '../../components/ui'
import { useI18n } from '../../i18n/context'
import type { RecurringSeries } from '../../lib/recurrence'

export interface UpcomingItem {
  series: RecurringSeries
  daysLeft: number
  amountTry: number
}

export function UpcomingPayments({ items }: { items: readonly UpcomingItem[] }) {
  const { t, f } = useI18n()
  const total = items.reduce((s, i) => s + i.amountTry, 0)
  const when = (days: number) => (days <= 0 ? t('common.today') : days === 1 ? t('common.tomorrow') : t('common.inDays', { count: days }))
  return (
    <section aria-labelledby="upcoming-title" className="card flex min-w-0 flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <div>
          <h2 id="upcoming-title" className="text-[0.9375rem] font-bold tracking-[-0.01em]">
            {t('overview.upcoming.title')}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">{t('overview.upcoming.subtitle')}</p>
        </div>
        <Link to="/subscriptions" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-soft-ink hover:underline">
          {t('overview.upcoming.link')}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pt-3 pb-5 text-sm text-ink-2">
          <CalendarCheck aria-hidden className="size-4 text-ink-3" />
          {t('overview.upcoming.empty')}
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line px-5">
            {items.slice(0, 5).map(({ series, daysLeft }) => (
              <li key={series.key} className="flex items-center gap-3 py-2.5">
                <span className="grid w-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 py-1 text-center leading-none">
                  <span className="text-[0.625rem] font-bold text-ink-3 uppercase">{f.date(series.nextDate, 'MMM')}</span>
                  <span className="tnum mt-0.5 text-sm font-bold text-ink">{f.date(series.nextDate, 'd')}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    <CategoryDot id={series.categoryId} />
                    <span className="truncate">{series.merchant}</span>
                  </p>
                  <p className="text-xs text-ink-3">
                    {t(`period.${series.period}`)} · {when(daysLeft)}
                  </p>
                </div>
                <span className="tnum text-sm font-semibold text-ink">{f.money(series.averageAmount, series.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto flex justify-between border-t border-line px-5 py-3 text-xs text-ink-3">
            <span>{t('overview.upcoming.total')}</span>
            <span className="tnum font-bold text-ink">{f.money(total, 'TRY', { decimals: 0 })}</span>
          </p>
        </>
      )}
    </section>
  )
}
