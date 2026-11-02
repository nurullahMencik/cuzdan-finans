export const DATE_FORMATS = ['dd.MM.yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'] as const
export type DateFormat = (typeof DATE_FORMATS)[number]

export type DecimalFormat = 'tr' | 'en'

const DATE_PATTERNS: Record<DateFormat, RegExp> = {
  'dd.MM.yyyy': /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  'yyyy-MM-dd': /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  'dd/MM/yyyy': /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
}

/** Drops a trailing time ("12.10.2026 14:35:02") that many banks append. */
function stripTime(value: string): string {
  return value.trim().replace(/[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/, '')
}

/** Parses a date in the given format into ISO yyyy-MM-dd, or null. */
export function parseDate(value: string, format: DateFormat): string | null {
  const match = DATE_PATTERNS[format].exec(stripTime(value))
  if (!match) return null
  const [, a = '', b = '', c = ''] = match
  const [year, month, day] = format === 'yyyy-MM-dd' ? [+a, +b, +c] : [+c, +b, +a]
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Picks the format that parses every non-empty sample; null if none does. */
export function detectDateFormat(samples: readonly string[]): DateFormat | null {
  const values = samples.map((s) => s.trim()).filter(Boolean)
  if (values.length === 0) return null
  let best: { format: DateFormat; ok: number } | null = null
  for (const format of DATE_FORMATS) {
    const ok = values.filter((v) => parseDate(v, format) !== null).length
    if (ok > 0 && (!best || ok > best.ok)) best = { format, ok }
  }
  return best && best.ok / values.length >= 0.8 ? best.format : null
}

function cleanNumber(value: string): { body: string; negative: boolean } | null {
  let v = value.trim().replace(/\u00a0/g, ' ')
  if (!v) return null
  let negative = false
  if (/^\(.*\)$/.test(v)) {
    negative = true
    v = v.slice(1, -1)
  }
  v = v.replace(/(?:TRY|TL|USD|EUR|₺|\$|€)/gi, '').replace(/\s+/g, '')
  if (v.endsWith('-')) {
    negative = !negative
    v = v.slice(0, -1)
  }
  if (v.startsWith('-')) {
    negative = !negative
    v = v.slice(1)
  } else if (v.startsWith('+')) {
    v = v.slice(1)
  }
  if (!/^[\d.,']+$/.test(v) || !/\d/.test(v)) return null
  return { body: v.replace(/'/g, ''), negative }
}

/**
 * Parses "1.234,56", "-45,90", "45,90-", "(1.234,56)", "₺1.234,56" (tr) or
 * "1,234.56" (en). Returns null for anything that is not a number.
 */
export function parseAmount(value: string, format: DecimalFormat): number | null {
  const cleaned = cleanNumber(value)
  if (!cleaned) return null
  const [group, decimal] = format === 'tr' ? ['.', ','] : [',', '.']
  const body = cleaned.body
  const parts = body.split(decimal)
  if (parts.length > 2) return null
  const intPart = parts[0] ?? ''
  const fracPart = parts[1]
  if (intPart.includes(group)) {
    // Grouped digits must be in blocks of three: 1.234.567
    const groups = intPart.split(group)
    if (groups.some((g, i) => (i === 0 ? g.length < 1 || g.length > 3 : g.length !== 3))) return null
  }
  if (fracPart !== undefined && !/^\d+$/.test(fracPart)) return null
  const normalized = intPart.split(group).join('') + (fracPart !== undefined ? `.${fracPart}` : '')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  const result = cleaned.negative ? -n : n
  return Object.is(result, -0) ? 0 : result
}

/**
 * Votes on the decimal separator using unambiguous samples. "1.234,56" or
 * "45,90" vote tr; "1,234.56" or "45.90" vote en. "1.234" alone is
 * ambiguous and abstains. Defaults to tr: the app targets Turkish banks.
 */
export function detectDecimalFormat(samples: readonly string[]): DecimalFormat {
  let tr = 0
  let en = 0
  for (const sample of samples) {
    const cleaned = cleanNumber(sample)
    if (!cleaned) continue
    const v = cleaned.body
    const lastComma = v.lastIndexOf(',')
    const lastDot = v.lastIndexOf('.')
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) tr++
      else en++
    } else if (lastComma >= 0) {
      if (/^\d{1,3}(,\d{3})+$/.test(v)) continue
      tr++
    } else if (lastDot >= 0) {
      if (/^\d{1,3}(\.\d{3})+$/.test(v)) continue
      en++
    }
  }
  return en > tr ? 'en' : 'tr'
}
