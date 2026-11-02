import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../../i18n/context'
import { TooltipBox } from './TooltipBox'

export interface TrendPoint {
  day: number
  current: number | null
  previous: number | null
}

interface Props {
  data: readonly TrendPoint[]
  currentLabel: string
  previousLabel: string
}

const AXIS_TICK = { fill: 'var(--ink-3)', fontSize: 11 }

export default function SpendingTrend({ data, currentLabel, previousLabel }: Props) {
  const { t, f } = useI18n()
  return (
    <ComposedChart responsive style={{ width: '100%', height: '100%' }} data={[...data]} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.16} />
          <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis
        dataKey="day"
        type="number"
        domain={[1, data.length]}
        ticks={[1, 5, 10, 15, 20, 25, data.length]}
        tickLine={false}
        axisLine={{ stroke: 'var(--chart-axis)' }}
        tick={AXIS_TICK}
        tickMargin={6}
      />
      <YAxis tickFormatter={(v: number) => f.moneyCompact(v)} width={58} tickLine={false} axisLine={false} tick={AXIS_TICK} />
      <Tooltip
        cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
        content={({ active, payload }) => {
          const point = active ? (payload[0]?.payload as TrendPoint | undefined) : undefined
          if (!point) return null
          const rows = [
            point.current !== null
              ? { key: 'c', label: currentLabel, value: f.money(point.current, 'TRY', { decimals: 0 }), color: 'var(--series-1)' }
              : null,
            point.previous !== null
              ? { key: 'p', label: previousLabel, value: f.money(point.previous, 'TRY', { decimals: 0 }), color: 'var(--ink-3)' }
              : null,
          ].filter((r) => r !== null)
          return <TooltipBox title={t('chart.trend.day', { day: point.day })} rows={rows} />
        }}
      />
      <Line
        dataKey="previous"
        name={previousLabel}
        type="monotone"
        stroke="var(--ink-3)"
        strokeOpacity={0.7}
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4, fill: 'var(--ink-3)', stroke: 'var(--surface)', strokeWidth: 2 }}
        isAnimationActive={false}
        connectNulls={false}
      />
      <Area
        dataKey="current"
        name={currentLabel}
        type="monotone"
        stroke="var(--series-1)"
        strokeWidth={2}
        fill="url(#trend-fill)"
        dot={false}
        activeDot={{ r: 4.5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
        isAnimationActive={false}
        connectNulls={false}
      />
    </ComposedChart>
  )
}
