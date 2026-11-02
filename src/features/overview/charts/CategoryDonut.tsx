import { Pie, PieChart, Sector, Tooltip, type PieSectorShapeProps } from 'recharts'
import { useI18n } from '../../../i18n/context'
import { TooltipBox } from './TooltipBox'

export interface DonutSlice {
  key: string
  label: string
  value: number
  share: number
  color: string
}

export default function CategoryDonut({ data, total }: { data: readonly DonutSlice[]; total: number }) {
  const { t, f } = useI18n()
  return (
    <div className="relative h-full w-full">
      <PieChart responsive style={{ width: '100%', height: '100%' }} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={[...data]}
          dataKey="value"
          nameKey="label"
          innerRadius="68%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          stroke="var(--surface)"
          strokeWidth={2}
          cornerRadius={3}
          isAnimationActive={false}
          shape={(props: PieSectorShapeProps) => {
            // Recharts passes `key` inside props; React wants it as a direct attribute.
            const { key, ...rest } = props as PieSectorShapeProps & { key?: string }
            const slice = rest.payload as DonutSlice | undefined
            return <Sector key={key} {...rest} fill={slice?.color ?? 'var(--other)'} opacity={rest.isActive ? 0.85 : 1} />
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            const slice = active ? (payload[0]?.payload as DonutSlice | undefined) : undefined
            if (!slice) return null
            return (
              <TooltipBox
                title={slice.label}
                rows={[{ key: 'v', label: f.percent(slice.share, { decimals: 1 }), value: f.money(slice.value, 'TRY', { decimals: 0 }), color: slice.color, shape: 'box' }]}
              />
            )
          }}
        />
      </PieChart>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[0.6875rem] font-semibold text-ink-3">{t('chart.categories.total')}</p>
          <p className="mt-0.5 text-lg font-bold tracking-tight text-ink">{f.money(total, 'TRY', { decimals: 0 })}</p>
        </div>
      </div>
    </div>
  )
}
