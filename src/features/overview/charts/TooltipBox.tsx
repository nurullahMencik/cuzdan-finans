import type { ReactNode } from 'react'

export interface TooltipRow {
  key: string
  label: string
  value: string
  color: string
  shape?: 'line' | 'box'
}

/** Shared tooltip body: value first (strong), series name second, line keys. */
export function TooltipBox({ title, rows, footer }: { title: string; rows: readonly TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-[11rem] rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink capitalize">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={r.shape === 'box' ? 'size-2 rounded-[2px]' : 'h-0.5 w-3 rounded-full'}
              style={{ background: r.color }}
            />
            <span className="tnum font-bold text-ink">{r.value}</span>
            <span className="text-ink-3">{r.label}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t border-line pt-1.5 text-ink-3">{footer}</div>}
    </div>
  )
}
