import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useData } from '../app/data'
import { useMonth } from '../app/month'
import { useI18n } from '../i18n/context'
import { addMonthsToMonth } from '../lib/dates'
import { IconButton } from './ui'

/** Previous / next arrows around a native month select. */
export function MonthSwitcher() {
  const { t, f } = useI18n()
  const { month, setMonth, currentMonth } = useMonth()
  const { transactions } = useData()

  const months = useMemo(() => {
    let earliest = currentMonth
    for (const tx of transactions) if (tx.date.slice(0, 7) < earliest) earliest = tx.date.slice(0, 7)
    const list: string[] = []
    for (let m = currentMonth; m >= earliest && list.length < 60; m = addMonthsToMonth(m, -1)) list.push(m)
    return list
  }, [transactions, currentMonth])

  const index = months.indexOf(month)
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
      <IconButton
        size="sm"
        icon={ChevronLeft}
        label={t('month.previous')}
        disabled={index === months.length - 1}
        onClick={() => setMonth(addMonthsToMonth(month, -1))}
      />
      <label className="sr-only" htmlFor="month-switcher">
        {t('month.label')}
      </label>
      <select
        id="month-switcher"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="h-8 min-w-[9.5rem] cursor-pointer appearance-none rounded-lg bg-transparent px-2 text-center text-sm font-bold text-ink capitalize hover:bg-surface-2"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {f.month(m)}
          </option>
        ))}
      </select>
      <IconButton
        size="sm"
        icon={ChevronRight}
        label={t('month.next')}
        disabled={index <= 0}
        onClick={() => setMonth(addMonthsToMonth(month, 1))}
      />
    </div>
  )
}
