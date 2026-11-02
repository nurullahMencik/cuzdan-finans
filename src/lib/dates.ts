/** Small, timezone-safe helpers for ISO calendar dates (yyyy-MM-dd). */

const DAY_MS = 86_400_000

export function toDayNumber(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** Local calendar date of a Date object as yyyy-MM-dd. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function daysInMonth(month: string): number {
  const [y = 0, m = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonthsToMonth(month: string, delta: number): string {
  const [y = 0, m = 1] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/** Adds calendar months, clamping the day (Jan 31 + 1 month → Feb 28/29). */
export function addMonthsToDate(iso: string, delta: number, preferredDay?: number): string {
  const month = addMonthsToMonth(monthOf(iso), delta)
  const day = Math.min(preferredDay ?? Number(iso.slice(8, 10)), daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days)
}

export function diffDays(a: string, b: string): number {
  return toDayNumber(a) - toDayNumber(b)
}

/** The last `count` months ending with `endMonth`, oldest first. */
export function monthRange(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonthsToMonth(endMonth, i - count + 1))
}
