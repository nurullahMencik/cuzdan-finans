import { useMemo, useState, type ReactNode } from 'react'
import { daysInMonth } from '../lib/dates'
import { useData } from './data'
import { defaultMonth, MonthContext, type MonthState } from './month'

export function MonthProvider({ children }: { children: ReactNode }) {
  const { today } = useData()
  const [month, setMonth] = useState(() => defaultMonth(today))
  const value = useMemo<MonthState>(() => {
    const currentMonth = today.slice(0, 7)
    const isCurrent = month === currentMonth
    const throughDay = isCurrent ? Number(today.slice(8, 10)) : month > currentMonth ? 0 : daysInMonth(month)
    return { month, setMonth, currentMonth, throughDay, isCurrent }
  }, [month, today])
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
}
