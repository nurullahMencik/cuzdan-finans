import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { Badge, CategoryLabel, Meter } from '../../components/ui'
import { useI18n } from '../../i18n/context'
import type { BudgetRow } from '../budgets/compute'

export function BudgetAlerts({ rows, className }: { rows: readonly BudgetRow[]; className?: string }) {
  const { t, f } = useI18n()
  const alerts = rows.filter((r) => r.status !== 'ok').slice(0, 4)
  return (
    <section aria-labelledby="alerts-title" className={`card flex min-w-0 flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="alerts-title" className="text-[0.9375rem] font-bold tracking-[-0.01em]">
          {t('overview.alerts.title')}
        </h2>
        <Link to="/budgets" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-soft-ink hover:underline">
          {t('overview.alerts.link')}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pt-3 pb-5 text-sm text-ink-2">
          <CircleCheck aria-hidden className="size-4 text-positive" />
          {t('overview.alerts.empty')}
        </p>
      ) : (
        <ul className="grid gap-x-8 gap-y-5 px-5 pt-4 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {alerts.map((row) => {
            const tone = row.status === 'over' ? 'danger' : 'warning'
            return (
              <li key={row.categoryId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <CategoryLabel id={row.categoryId} className="font-semibold text-ink" />
                  <Badge tone={tone} icon={TriangleAlert}>
                    {t(`budgets.status.${row.status}`)}
                  </Badge>
                </div>
                <Meter
                  value={row.spent}
                  max={row.limit}
                  tone={row.status === 'over' ? 'danger' : 'warning'}
                  label={`${t(`category.${row.categoryId}`)}: ${t('budgets.spentOf', { spent: f.money(row.spent, 'TRY', { decimals: 0 }), limit: f.money(row.limit, 'TRY', { decimals: 0 }) })}`}
                />
                <p className="flex justify-between text-xs text-ink-3">
                  <span className="tnum">
                    {t('budgets.spentOf', { spent: f.money(row.spent, 'TRY', { decimals: 0 }), limit: f.money(row.limit, 'TRY', { decimals: 0 }) })}
                  </span>
                  <span className="tnum">{t('budgets.forecast', { amount: f.money(row.forecast, 'TRY', { decimals: 0 }) })}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
