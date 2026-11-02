import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { Download, FunnelX, Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useData } from '../../app/data'
import { useToast } from '../../app/toast'
import { Button, Field, IconButton, PageHeader } from '../../components/ui'
import { useMediaQuery } from '../../components/useMediaQuery'
import { saveLearnedRule, setTransactionCategory } from '../../db/repo'
import type { CategoryId, Rule } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { suggestRuleFromCorrection } from '../../lib/rules'
import { CategorySelect } from './CategorySelect'
import { downloadText, toCsv } from './exportCsv'
import { activeFilterCount, filterTransactions, parseFilters, type FILTER_KEYS, type TxFilters } from './filter'
import { LearnPrompt, type LearnState } from './LearnPrompt'
import { useTxRows, type TxRow } from './rows'
import { TransactionTable } from './TransactionTable'

type FilterKey = (typeof FILTER_KEYS)[number]
type PendingRule = LearnState & { rule: Omit<Rule, 'id' | 'createdAt'> }

export function TransactionsPage() {
  const { t, f, locale } = useI18n()
  const { notify } = useToast()
  const { txTry, transactions, accounts, rules, today } = useData()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const deferredFilters = useDeferredValue(filters)
  const compact = !useMediaQuery('(min-width: 768px)')

  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [learn, setLearn] = useState<PendingRule | null>(null)
  const [busy, setBusy] = useState(false)

  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const allRows = useTxRows(txTry, accountNames)
  const rows = useMemo(() => filterTransactions(allRows, deferredFilters), [allRows, deferredFilters])
  const selectedIds = useMemo(() => {
    const visible = new Set(rows.map((r) => r.id))
    return Object.keys(selection).filter((id) => selection[id] && visible.has(id))
  }, [selection, rows])

  const setFilter = (key: FilterKey, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true })

  const changeCategory = (tx: TxRow, categoryId: CategoryId) => {
    if (tx.categoryId === categoryId) return
    const suggestion = suggestRuleFromCorrection(tx, categoryId, transactions, rules)
    void setTransactionCategory([tx.id], categoryId).then(() => {
      if (suggestion) {
        setLearn({ merchant: tx.merchant, categoryId, affected: suggestion.affected, rule: suggestion.rule })
      } else {
        notify({ message: t('tx.categoryChanged', { merchant: tx.merchant, category: t(`category.${categoryId}`) }), tone: 'success' })
      }
    })
  }

  const createRule = () => {
    if (!learn) return
    setBusy(true)
    const { priority: _priority, ...rule } = learn.rule
    void saveLearnedRule(rule)
      .then((count) => {
        notify({ message: t('learn.created', { count }), tone: 'success' })
        setLearn(null)
      })
      .finally(() => setBusy(false))
  }

  const applyBulk = (categoryId: CategoryId) => {
    const ids = selectedIds
    void setTransactionCategory(ids, categoryId).then(() => {
      notify({ message: t('tx.bulk.done', { count: ids.length }), tone: 'success' })
      setSelection({})
    })
  }

  const exportCsv = () => {
    const chosen = selectedIds.length > 0 ? rows.filter((r) => selection[r.id]) : rows
    const sorted = [...chosen].sort((a, b) => b.date.localeCompare(a.date))
    const csv = toCsv(
      sorted,
      [
        { header: t('tx.col.date'), value: (r) => r.date },
        { header: t('tx.col.description'), value: (r) => r.description },
        { header: t('subs.col.merchant'), value: (r) => r.merchant },
        { header: t('tx.col.category'), value: (r) => t(`category.${r.categoryId}`) },
        { header: t('tx.col.account'), value: (r) => r.accountName },
        { header: t('tx.col.amount'), value: (r) => r.amount },
        { header: t('accounts.form.currency'), value: (r) => r.currency },
        { header: 'TRY', value: (r) => Math.round(r.amountTry * 100) / 100 },
      ],
      locale,
    )
    downloadText(csv, `cuzdan-${locale === 'tr' ? 'islemler' : 'transactions'}-${today}.csv`)
    notify({ message: t('tx.export.done', { count: sorted.length }), tone: 'success' })
  }

  return (
    <>
      <PageHeader
        title={t('tx.title')}
        subtitle={`${t('tx.subtitle', { total: f.number(transactions.length) })} · ${t('tx.showing', { count: f.number(rows.length) })}`}
        actions={
          <Button icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
            {t('tx.export')}
          </Button>
        }
      />

      <FiltersBar filters={filters} setFilter={setFilter} clear={clearFilters} compact={compact} />

      {selectedIds.length > 0 && <BulkBar count={selectedIds.length} onApply={applyBulk} onClear={() => setSelection({})} />}

      <TransactionTable
        rows={rows}
        sorting={sorting}
        onSortingChange={setSorting}
        selection={selection}
        onSelectionChange={setSelection}
        onCategoryChange={changeCategory}
        compact={compact}
      />

      {learn && <LearnPrompt state={learn} busy={busy} onCreate={createRule} onDismiss={() => setLearn(null)} />}
    </>
  )
}

function FiltersBar({
  filters,
  setFilter,
  clear,
  compact,
}: {
  filters: TxFilters
  setFilter: (key: FilterKey, value: string) => void
  clear: () => void
  compact: boolean
}) {
  const { t } = useI18n()
  const { accounts } = useData()
  const [open, setOpen] = useState(false)
  const active = activeFilterCount(filters)
  const showDetails = !compact || open

  return (
    <div className="card mb-4 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <label htmlFor="tx-search" className="sr-only">
            {t('tx.search')}
          </label>
          <input
            id="tx-search"
            type="search"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder={t('tx.search')}
            className="field pl-9"
            autoComplete="off"
          />
        </div>
        {compact && (
          <Button icon={SlidersHorizontal} aria-expanded={open} aria-controls="tx-filters" onClick={() => setOpen((v) => !v)}>
            {t('tx.filters')}
            {active > 0 && <span className="rounded-full bg-accent px-1.5 text-[0.6875rem] text-accent-ink">{active}</span>}
          </Button>
        )}
        {!compact && active > 0 && (
          <Button variant="ghost" icon={FunnelX} onClick={clear}>
            {t('tx.filter.clear')}
          </Button>
        )}
      </div>
      <div id="tx-filters" hidden={!showDetails} className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Field label={t('tx.filter.account')}>
          {({ id }) => (
            <select id={id} className="field" value={filters.account} onChange={(e) => setFilter('account', e.target.value)}>
              <option value="">{t('tx.filter.allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('tx.filter.category')}>
          {({ id }) => (
            <CategorySelect
              id={id}
              size="md"
              value={filters.category}
              placeholder={t('tx.filter.allCategories')}
              label={t('tx.filter.category')}
              onChange={(v) => setFilter('category', v)}
            />
          )}
        </Field>
        <Field label={t('tx.filter.dateFrom')}>
          {({ id }) => (
            <input id={id} type="date" className="field" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
          )}
        </Field>
        <Field label={t('tx.filter.dateTo')}>
          {({ id }) => (
            <input id={id} type="date" className="field" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
          )}
        </Field>
        <Field label={`${t('tx.filter.amountMin')} (₺)`}>
          {({ id }) => (
            <input id={id} type="number" inputMode="decimal" min={0} className="field tnum" value={filters.min ?? ''} onChange={(e) => setFilter('min', e.target.value)} />
          )}
        </Field>
        <Field label={`${t('tx.filter.amountMax')} (₺)`}>
          {({ id }) => (
            <input id={id} type="number" inputMode="decimal" min={0} className="field tnum" value={filters.max ?? ''} onChange={(e) => setFilter('max', e.target.value)} />
          )}
        </Field>
        {compact && active > 0 && (
          <Button variant="ghost" icon={FunnelX} onClick={clear} className="col-span-2 justify-self-start">
            {t('tx.filter.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}

function BulkBar({ count, onApply, onClear }: { count: number; onApply: (id: CategoryId) => void; onClear: () => void }) {
  const { t } = useI18n()
  const [category, setCategory] = useState<CategoryId | ''>('')
  return (
    <div
      role="region"
      aria-label={t('tx.bulk.selected', { count })}
      className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 shadow-card lg:top-3"
    >
      <p className="mr-auto text-sm font-bold text-accent-soft-ink">{t('tx.bulk.selected', { count })}</p>
      <CategorySelect value={category} placeholder={t('tx.bulk.assign')} label={t('tx.bulk.assign')} onChange={setCategory} className="w-48 bg-surface" />
      <Button size="sm" variant="primary" disabled={!category} onClick={() => category && onApply(category)}>
        {t('tx.bulk.apply')}
      </Button>
      <IconButton size="sm" icon={X} label={t('tx.bulk.clear')} onClick={onClear} />
    </div>
  )
}
