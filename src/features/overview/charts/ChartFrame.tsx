import { ChartColumn, Table2 } from 'lucide-react'
import { Suspense, useState, type ReactNode } from 'react'
import { Card, IconButton } from '../../../components/ui'
import { useI18n } from '../../../i18n/context'

interface Props {
  title: string
  subtitle?: ReactNode
  legend?: ReactNode
  height: number
  chart: ReactNode
  table: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Card wrapper for a lazily loaded chart. Reserves the chart height while the
 * chart bundle loads (no layout shift) and offers a table view twin, so no
 * value is reachable only through colour or hover.
 */
export function ChartFrame({ title, subtitle, legend, height, chart, table, footer, className }: Props) {
  const { t } = useI18n()
  const [showTable, setShowTable] = useState(false)
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        <IconButton
          size="sm"
          icon={showTable ? ChartColumn : Table2}
          label={showTable ? t('common.showChart') : t('common.showTable')}
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        />
      }
    >
      {legend && !showTable && <div className="mb-3">{legend}</div>}
      {showTable ? (
        <div className="max-h-[320px] overflow-auto">{table}</div>
      ) : (
        <>
          <div style={{ height }} className="relative w-full">
            <Suspense fallback={<p className="grid h-full place-items-center text-xs text-ink-3">{t('chart.loading')}</p>}>{chart}</Suspense>
          </div>
          {footer}
        </>
      )}
    </Card>
  )
}

export function LegendItem({ color, label, shape = 'box' }: { color: string; label: string; shape?: 'box' | 'line' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span
        aria-hidden
        className={shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]'}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

export function DataTable({ head, rows }: { head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <table className="w-full text-left text-[0.8125rem]">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-line text-ink-3">
          {head.map((h, i) => (
            <th key={h} scope="col" className={`py-2 font-semibold ${i > 0 ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-line/70 last:border-0">
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="py-1.5 font-medium text-ink capitalize">
                  {cell}
                </th>
              ) : (
                <td key={i} className="tnum py-1.5 text-right text-ink-2">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
