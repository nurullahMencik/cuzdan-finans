import { CircleAlert, CircleCheck, Pencil, PiggyBank, Plus, Trash, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useData } from '../../app/data'
import { useMonth } from '../../app/month'
import { useToast } from '../../app/toast'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { Badge, Button, CategoryLabel, EmptyState, Field, IconButton, Meter, PageHeader } from '../../components/ui'
import { deleteBudget, saveBudget } from '../../db/repo'
import { EXPENSE_CATEGORIES } from '../../domain/categories'
import type { CategoryId } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { expenseByCategory } from '../../lib/analytics'
import type { BudgetStatus } from '../../lib/budget'
import { daysInMonth } from '../../lib/dates'
import { computeBudgetRows, type BudgetRow } from './compute'

const STATUS_UI: Record<BudgetStatus, { tone: 'positive' | 'warning' | 'danger'; icon: LucideIcon; meter: 'ok' | 'warning' | 'danger' }> = {
  ok: { tone: 'positive', icon: CircleCheck, meter: 'ok' },
  warning: { tone: 'warning', icon: TriangleAlert, meter: 'warning' },
  'at-risk': { tone: 'warning', icon: TrendingUp, meter: 'warning' },
  over: { tone: 'danger', icon: CircleAlert, meter: 'danger' },
}

export function BudgetsPage() {
  const { t, f } = useI18n()
  const { txTry, budgets } = useData()
  const { month, throughDay, isCurrent, currentMonth } = useMonth()

  const rows = useMemo(() => computeBudgetRows(txTry, budgets, month, throughDay), [txTry, budgets, month, throughDay])
  const unbudgeted = useMemo(() => {
    const budgeted = new Set(budgets.map((b) => b.categoryId))
    return expenseByCategory(txTry, month)
      .filter((c) => !budgeted.has(c.categoryId))
      .reduce((s, c) => s + c.amount, 0)
  }, [txTry, budgets, month])

  const totals = rows.reduce((acc, r) => ({ limit: acc.limit + r.limit, spent: acc.spent + r.spent, forecast: acc.forecast + r.forecast }), {
    limit: 0,
    spent: 0,
    forecast: 0,
  })
  const days = daysInMonth(month)
  const note =
    month > currentMonth
      ? t('budgets.summary.future')
      : isCurrent
        ? t('budgets.summary.daysLeft', { count: days - throughDay })
        : t('budgets.summary.closed')
  const overallTone = totals.spent > totals.limit ? 'danger' : totals.forecast > totals.limit ? 'warning' : 'ok'

  return (
    <>
      <PageHeader title={t('budgets.title')} subtitle={t('budgets.subtitle')} actions={<MonthSwitcher />} />

      <section aria-label={t('budgets.summary.limit')} className="card mb-4 grid gap-5 p-5 sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] sm:items-end">
        <Stat label={t('budgets.summary.limit')} value={f.money(totals.limit, 'TRY', { decimals: 0 })} />
        <Stat label={t('budgets.summary.spent')} value={f.money(totals.spent, 'TRY', { decimals: 0 })} />
        <Stat
          label={t('budgets.summary.forecast')}
          value={f.money(totals.forecast, 'TRY', { decimals: 0 })}
          tone={totals.forecast > totals.limit ? 'text-negative' : undefined}
        />
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-3">{note}</p>
          <Meter
            value={totals.spent}
            max={totals.limit}
            tone={overallTone}
            marker={isCurrent ? (totals.limit * throughDay) / days : undefined}
            label={t('budgets.spentOf', { spent: f.money(totals.spent, 'TRY', { decimals: 0 }), limit: f.money(totals.limit, 'TRY', { decimals: 0 }) })}
          />
          <p className="tnum text-xs text-ink-3">
            {t('budgets.spentOf', { spent: f.money(totals.spent, 'TRY', { decimals: 0 }), limit: f.money(totals.limit, 'TRY', { decimals: 0 }) })}
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={PiggyBank}>{t('budgets.empty')}</EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <BudgetCard key={row.categoryId} row={row} showPace={isCurrent} />
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AddBudget />
        <div className="card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-bold text-ink">{t('budgets.unbudgeted')}</p>
            <p className="mt-0.5 text-xs text-ink-3">{t('budgets.unbudgetedHint')}</p>
          </div>
          <p className="tnum text-lg font-bold text-ink">{f.money(unbudgeted, 'TRY', { decimals: 0 })}</p>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${tone ?? 'text-ink'}`}>{value}</p>
    </div>
  )
}

function BudgetCard({ row, showPace }: { row: BudgetRow; showPace: boolean }) {
  const { t, f } = useI18n()
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(row.limit))
  const ui = STATUS_UI[row.status]
  const category = t(`category.${row.categoryId}`)
  const money = (v: number) => f.money(v, 'TRY', { decimals: 0 })
  const remaining = row.limit - row.spent

  const save = (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(draft.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) return
    void saveBudget({ categoryId: row.categoryId, amount }).then(() => {
      setEditing(false)
      notify({ message: t('budgets.saved', { category }), tone: 'success' })
    })
  }

  return (
    <li className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CategoryLabel id={row.categoryId} className="text-[0.9375rem] font-bold text-ink" />
          <p className="tnum mt-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">{money(row.spent)}</span> / {money(row.limit)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={ui.tone} icon={ui.icon}>
            {t(`budgets.status.${row.status}`)}
          </Badge>
          <IconButton
            size="sm"
            icon={Pencil}
            label={`${t('budgets.edit')}: ${category}`}
            onClick={() => {
              setDraft(String(row.limit))
              setEditing((v) => !v)
            }}
          />
          <IconButton
            size="sm"
            icon={Trash}
            label={`${t('budgets.remove')}: ${category}`}
            onClick={() => void deleteBudget(row.categoryId).then(() => notify({ message: t('budgets.removed', { category }) }))}
          />
        </div>
      </div>
      <Meter
        value={row.spent}
        max={row.limit}
        tone={ui.meter}
        marker={showPace ? row.pace : undefined}
        label={`${category}: ${t('budgets.spentOf', { spent: money(row.spent), limit: money(row.limit) })}`}
      />
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
        <span className={remaining < 0 ? 'font-semibold text-negative' : 'text-ink-2'}>
          {remaining < 0 ? t('budgets.overBy', { amount: money(-remaining) }) : t('budgets.left', { amount: money(remaining) })}
        </span>
        <span className={row.forecast > row.limit ? 'font-semibold text-negative' : 'text-ink-2'}>
          {t('budgets.forecast', { amount: money(row.forecast) })}
          {row.forecast > row.limit && row.spent <= row.limit && ` · ${t('budgets.forecastOver', { amount: money(row.forecast - row.limit) })}`}
        </span>
      </div>
      {showPace && <p className="text-xs text-ink-3">{row.isFixed ? t('budgets.fixedNote') : t('budgets.paceMarker', { amount: money(row.pace) })}</p>}
      {editing && (
        <form onSubmit={save} className="flex items-end gap-2 border-t border-line pt-3">
          <Field label={t('budgets.limitFor', { category })} className="flex-1">
            {({ id }) => (
              <input id={id} className="field tnum" inputMode="decimal" type="number" min={1} value={draft} onChange={(e) => setDraft(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="primary">
            {t('common.save')}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            {t('common.cancel')}
          </Button>
        </form>
      )}
    </li>
  )
}

function AddBudget() {
  const { t } = useI18n()
  const { notify } = useToast()
  const { budgets } = useData()
  const available = EXPENSE_CATEGORIES.filter((c) => !budgets.some((b) => b.categoryId === c.id))
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [amount, setAmount] = useState('')
  const selected = category && available.some((c) => c.id === category) ? category : (available[0]?.id ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!selected || !Number.isFinite(value) || value <= 0) return
    void saveBudget({ categoryId: selected, amount: value }).then(() => {
      notify({ message: t('budgets.saved', { category: t(`category.${selected}`) }), tone: 'success' })
      setAmount('')
      setCategory('')
    })
  }

  return (
    <form onSubmit={submit} className="card p-5" aria-labelledby="add-budget-title">
      <h2 id="add-budget-title" className="text-sm font-bold text-ink">
        {t('budgets.add')}
      </h2>
      {available.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t('budgets.add.allSet')}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label={t('budgets.add.category')} className="min-w-[10rem] flex-1">
            {({ id }) => (
              <select id={id} className="field" value={selected} onChange={(e) => setCategory(e.target.value as CategoryId)}>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(`category.${c.id}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('budgets.add.amount')} className="w-36">
            {({ id }) => (
              <input id={id} className="field tnum" type="number" inputMode="decimal" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="primary" icon={Plus}>
            {t('budgets.add')}
          </Button>
        </div>
      )}
    </form>
  )
}
