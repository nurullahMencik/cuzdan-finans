import { createContext, useContext } from 'react'

export interface MonthState {
  /** Selected month, yyyy-MM. */
  month: string
  setMonth: (month: string) => void
  /** Month containing today. */
  currentMonth: string
  /** Day of month the selected month's data runs through (full month if past). */
  throughDay: number
  isCurrent: boolean
}

export const MonthContext = createContext<MonthState | null>(null)

export function useMonth(): MonthState {
  const ctx = useContext(MonthContext)
  if (!ctx) throw new Error('useMonth must be used inside <MonthProvider>')
  return ctx
}

/**
 * During the first week of a month there is too little data for a useful
 * summary, so the dashboard opens on the previous (complete) month.
 */
export function defaultMonth(today: string): string {
  const day = Number(today.slice(8, 10))
  const [y = 0, m = 1] = today.split('-').map(Number)
  if (day >= 8) return today.slice(0, 7)
  const prev = new Date(Date.UTC(y, m - 2, 1))
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
}
