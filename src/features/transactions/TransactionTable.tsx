import {
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type Row,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from 'lucide-react'
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { cx } from '../../components/classes'
import { CategoryDot, EmptyState } from '../../components/ui'
import type { CategoryId, CurrencyCode } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { CategorySelect } from './CategorySelect'
import type { TxRow } from './rows'

const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
})

const helper = createColumnHelper<typeof features, TxRow>()

const columns = helper.columns([
  helper.display({ id: 'select', enableSorting: false }),
  helper.accessor('date', { id: 'date', sortFn: 'basic' }),
  helper.accessor('merchant', { id: 'description', sortFn: 'alphanumeric' }),
  helper.accessor('categoryLabel', { id: 'category', sortFn: 'alphanumeric' }),
  helper.accessor('accountName', { id: 'account', sortFn: 'alphanumeric' }),
  helper.accessor('amountTry', { id: 'amount', sortFn: 'basic' }),
])

type ColumnId = 'select' | 'date' | 'description' | 'category' | 'account' | 'amount'

const ROW_HEIGHT = 56
const CARD_HEIGHT = 112

interface Props {
  rows: TxRow[]
  sorting: SortingState
  onSortingChange: Dispatch<SetStateAction<SortingState>>
  selection: RowSelectionState
  onSelectionChange: Dispatch<SetStateAction<RowSelectionState>>
  onCategoryChange: (tx: TxRow, categoryId: CategoryId) => void
  compact: boolean
}

/**
 * TanStack Table owns sorting and selection; TanStack Virtual renders only
 * the rows in view, so 2 000+ rows scroll at 60 fps. Desktop renders a real
 * <table> with spacer rows; small screens get a virtualised card list.
 */
export function TransactionTable(props: Props) {
  const { rows, sorting, onSortingChange, selection, onSelectionChange } = props
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: { sorting, rowSelection: selection },
    onSortingChange,
    onRowSelectionChange: onSelectionChange,
    enableSortingRemoval: false,
  })
  const model = table.getRowModel().rows

  if (rows.length === 0) {
    return <EmptyStateRow />
  }
  return props.compact ? (
    <CardList rows={model} onCategoryChange={props.onCategoryChange} />
  ) : (
    <DesktopTable table={table} rows={model} onCategoryChange={props.onCategoryChange} />
  )
}

function EmptyStateRow() {
  const { t } = useI18n()
  return (
    <div className="card">
      <EmptyState icon={SearchX}>{t('tx.empty')}</EmptyState>
    </div>
  )
}

type TxTable = ReturnType<typeof useTable<typeof features, TxRow>>
type TxRowModel = Row<typeof features, TxRow>

function DesktopTable({ table, rows, onCategoryChange }: { table: TxTable; rows: TxRowModel[]; onCategoryChange: Props['onCategoryChange'] }) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns fresh functions each render; it is not compatible with memoisation.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    getItemKey: (index) => rows[index]?.id ?? index,
  })
  const items = virtualizer.getVirtualItems()
  const paddingTop = items[0]?.start ?? 0
  const paddingBottom = virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0)

  const headers: { id: ColumnId; label: string; className?: string; align?: 'right' }[] = [
    { id: 'date', label: t('tx.col.date') },
    { id: 'description', label: t('tx.col.description') },
    { id: 'category', label: t('tx.col.category') },
    { id: 'account', label: t('tx.col.account') },
    { id: 'amount', label: t('tx.col.amount'), align: 'right' },
  ]

  const allSelected = table.getIsAllRowsSelected()
  const someSelected = table.getIsSomeRowsSelected()

  return (
    <div className="card overflow-hidden">
      <div ref={scrollRef} className="h-[max(420px,calc(100dvh-330px))] overflow-auto overscroll-contain" tabIndex={-1}>
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm" aria-label={t('tx.rowsLabel')} aria-rowcount={rows.length + 1}>
          <colgroup>
            <col className="w-12" />
            <col className="w-[7.5rem]" />
            <col />
            <col className="w-[13.5rem]" />
            <col className="w-[9.5rem]" />
            <col className="w-[9.5rem]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr aria-rowindex={1} className="bg-surface-2/95 backdrop-blur">
              <th scope="col" className="border-b border-line px-4 py-0 text-left">
                <input
                  type="checkbox"
                  aria-label={t('tx.selectAll')}
                  className="size-4 accent-[var(--accent)]"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected
                  }}
                  onChange={() => table.toggleAllRowsSelected(!allSelected)}
                />
              </th>
              {headers.map((h) => {
                const column = table.getColumn(h.id)
                const sorted = column?.getIsSorted() ?? false
                const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                    className={cx('h-11 border-b border-line px-3 font-semibold text-ink-2', h.align === 'right' ? 'text-right' : 'text-left')}
                  >
                    <button
                      type="button"
                      onClick={() => column?.toggleSorting(sorted === 'asc')}
                      className={cx(
                        'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[0.8125rem] hover:text-ink',
                        h.align === 'right' && 'flex-row-reverse',
                        sorted && 'text-ink',
                      )}
                    >
                      {h.label}
                      <Icon aria-hidden className={cx('size-3.5', !sorted && 'opacity-40')} />
                      <span className="sr-only">, {t('tx.sortBy', { column: h.label })}</span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden>
                <td colSpan={6} style={{ height: paddingTop, padding: 0 }} />
              </tr>
            )}
            {items.map((item) => {
              const row = rows[item.index]
              if (!row) return null
              const tx = row.original
              const selected = row.getIsSelected()
              return (
                <tr
                  key={row.id}
                  aria-rowindex={item.index + 2}
                  aria-selected={selected}
                  style={{ height: ROW_HEIGHT }}
                  className={cx('group', selected ? 'bg-accent-soft/60' : 'hover:bg-surface-2/60')}
                >
                  <td className="border-b border-line/70 px-4">
                    <input
                      type="checkbox"
                      aria-label={t('tx.selectRow', { description: tx.merchant })}
                      className="size-4 accent-[var(--accent)]"
                      checked={selected}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </td>
                  <td className="tnum border-b border-line/70 px-3 whitespace-nowrap text-ink-2">
                    <DateCell iso={tx.date} />
                  </td>
                  <td className="border-b border-line/70 px-3">
                    <p className="truncate font-semibold text-ink">{tx.merchant}</p>
                    <p className="truncate text-xs text-ink-3" title={tx.description}>
                      {tx.description}
                    </p>
                  </td>
                  <td className="border-b border-line/70 px-3">
                    <span className="flex items-center gap-2">
                      <CategoryDot id={tx.categoryId} />
                      <CategorySelect
                        value={tx.categoryId}
                        label={t('tx.categoryFor', { merchant: tx.merchant })}
                        onChange={(id) => onCategoryChange(tx, id)}
                        className="min-w-0 flex-1 border-transparent bg-transparent hover:border-line-strong"
                      />
                    </span>
                  </td>
                  <td className="truncate border-b border-line/70 px-3 text-ink-2">{tx.accountName}</td>
                  <td className="border-b border-line/70 px-3 text-right">
                    <AmountCell amount={tx.amount} currency={tx.currency} amountTry={tx.amountTry} />
                  </td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={6} style={{ height: paddingBottom, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CardList({ rows, onCategoryChange }: { rows: TxRowModel[]; onCategoryChange: Props['onCategoryChange'] }) {
  const { t } = useI18n()
  // The list's distance from the top of the page, measured once it mounts.
  const [scrollMargin, setScrollMargin] = useState(0)
  const listRef = useCallback((el: HTMLUListElement | null) => {
    if (el) setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
  }, [])
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => CARD_HEIGHT,
    overscan: 6,
    scrollMargin,
    getItemKey: (index) => rows[index]?.id ?? index,
  })
  return (
    <ul ref={listRef} aria-label={t('tx.rowsLabel')} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]
        if (!row) return null
        const tx = row.original
        const selected = row.getIsSelected()
        return (
          <li
            key={row.id}
            className="absolute inset-x-0 top-0 pb-2"
            style={{ height: CARD_HEIGHT, transform: `translateY(${item.start - scrollMargin}px)` }}
          >
            <div className={cx('card flex h-full flex-col justify-between px-3.5 py-3', selected && 'ring-2 ring-accent')}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={t('tx.selectRow', { description: tx.merchant })}
                  className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  checked={selected}
                  onChange={row.getToggleSelectedHandler()}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{tx.merchant}</p>
                  <p className="truncate text-xs text-ink-3">
                    <DateCell iso={tx.date} /> · {tx.accountName}
                  </p>
                </div>
                <AmountCell amount={tx.amount} currency={tx.currency} amountTry={tx.amountTry} />
              </div>
              <div className="flex items-center gap-2 pl-7">
                <CategoryDot id={tx.categoryId} />
                <CategorySelect
                  value={tx.categoryId}
                  label={t('tx.categoryFor', { merchant: tx.merchant })}
                  onChange={(id) => onCategoryChange(tx, id)}
                  className="min-w-0 flex-1"
                />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DateCell({ iso }: { iso: string }) {
  const { f } = useI18n()
  return <time dateTime={iso}>{f.date(iso, 'd MMM yyyy')}</time>
}

function AmountCell({ amount, currency, amountTry }: { amount: number; currency: CurrencyCode; amountTry: number }) {
  const { f, t } = useI18n()
  return (
    <span className="flex flex-col items-end">
      <span className={cx('tnum font-semibold whitespace-nowrap', amount > 0 ? 'text-positive' : 'text-ink')}>
        {f.money(amount, currency, { signed: amount > 0 })}
      </span>
      {currency !== 'TRY' && (
        <span className="tnum text-xs whitespace-nowrap text-ink-3" title={t('tx.inTry', { amount: f.money(amountTry) })}>
          ≈ {f.money(amountTry)}
        </span>
      )}
    </span>
  )
}
