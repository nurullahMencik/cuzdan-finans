import { Bar, CartesianGrid, ComposedChart, Line, Rectangle, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts'
import { useI18n } from '../../../i18n/context'
import { TooltipBox } from './TooltipBox'

export interface CashflowPoint {
  month: string
  label: string
  income: number
  expense: number
  net: number
}

interface Props {
  data: readonly CashflowPoint[]
  selected: string
  onSelect: (month: string) => void
}

const AXIS_TICK = { fill: 'var(--ink-3)', fontSize: 11 }

export default function CashflowChart({ data, selected, onSelect }: Props) {
  const { t, f } = useI18n()
  // The selected month stays solid; the others recede so it reads at a glance.
  const emphasise = (color: string) => (props: BarShapeProps) => {
    const { key, ...rest } = props as BarShapeProps & { key?: string }
    const payload = rest.payload as CashflowPoint | undefined
    return <Rectangle key={key} {...rest} fill={color} fillOpacity={payload?.month === selected ? 1 : 0.42} />
  }
  return (
    <ComposedChart
      responsive
      style={{ width: '100%', height: '100%' }}
      data={[...data]}
      margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
      barGap={2}
      barCategoryGap="30%"
      className="cursor-pointer"
      onClick={(state) => {
        const index = typeof state.activeIndex === 'number' ? state.activeIndex : Number(state.activeIndex)
        const point = Number.isFinite(index) ? data[index] : undefined
        if (point) onSelect(point.month)
      }}
    >
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} tick={AXIS_TICK} interval={0} tickMargin={6} />
      <YAxis tickFormatter={(v: number) => f.moneyCompact(v)} width={58} tickLine={false} axisLine={false} tick={AXIS_TICK} />
      <Tooltip
        cursor={{ fill: 'var(--surface-2)', opacity: 0.7 }}
        content={({ active, payload }) => {
          const point = active ? (payload[0]?.payload as CashflowPoint | undefined) : undefined
          if (!point) return null
          return (
            <TooltipBox
              title={f.month(point.month)}
              rows={[
                { key: 'i', label: t('chart.cashflow.income'), value: f.money(point.income, 'TRY', { decimals: 0 }), color: 'var(--income)', shape: 'box' },
                { key: 'e', label: t('chart.cashflow.expense'), value: f.money(point.expense, 'TRY', { decimals: 0 }), color: 'var(--expense)', shape: 'box' },
                { key: 'n', label: t('chart.cashflow.net'), value: f.money(point.net, 'TRY', { decimals: 0, signed: true }), color: 'var(--ink)' },
              ]}
            />
          )
        }}
      />
      <Bar dataKey="income" name={t('chart.cashflow.income')} fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={14} shape={emphasise('var(--income)')} isAnimationActive={false} />
      <Bar dataKey="expense" name={t('chart.cashflow.expense')} fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={14} shape={emphasise('var(--expense)')} isAnimationActive={false} />
      <Line
        dataKey="net"
        name={t('chart.cashflow.net')}
        type="monotone"
        stroke="var(--ink)"
        strokeWidth={2}
        dot={{ r: 3.5, fill: 'var(--ink)', stroke: 'var(--surface)', strokeWidth: 2 }}
        activeDot={{ r: 5, fill: 'var(--ink)', stroke: 'var(--surface)', strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </ComposedChart>
  )
}
