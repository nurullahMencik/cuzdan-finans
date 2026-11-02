import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cx } from '../../components/classes'

export interface KpiDelta {
  /** Text such as "+12%" or "+3,1 puan". */
  text: string
  direction: 'up' | 'down' | 'flat'
  /** Whether this direction is good news for the metric. */
  good: boolean | null
  caption: string
}

interface Props {
  label: string
  value: string
  delta: KpiDelta | null
  noDeltaText: string
  trend: readonly number[]
  trendLabel: string
}

export function KpiTile({ label, value, delta, noDeltaText, trend, trendLabel }: Props) {
  const Icon = delta?.direction === 'up' ? ArrowUpRight : delta?.direction === 'down' ? ArrowDownRight : Minus
  const tone = delta?.good === null || !delta ? 'text-ink-3 bg-surface-2' : delta.good ? 'text-positive bg-positive-soft' : 'text-negative bg-danger-soft'
  return (
    <div className="card flex min-w-0 flex-col justify-between gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-ink-2">{label}</p>
        <Sparkline values={trend} label={trendLabel} />
      </div>
      <p className="text-[1.375rem] leading-none font-bold tracking-[-0.025em] text-ink sm:text-[1.75rem]">{value}</p>
      {delta ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-3">
          <span className={cx('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold', tone)}>
            <Icon aria-hidden className="size-3.5" />
            {delta.text}
          </span>
          <span>{delta.caption}</span>
        </p>
      ) : (
        <p className="text-xs text-ink-3">{noDeltaText}</p>
      )}
    </div>
  )
}

/** 12-point trend line; the latest point is marked. Decorative: values are in the cash-flow table. */
function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  const w = 64
  const h = 22
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)] as const)
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="hidden shrink-0 overflow-visible sm:block">
      <path d={d} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2.75} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />}
    </svg>
  )
}
