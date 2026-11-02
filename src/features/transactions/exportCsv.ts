export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number
}

/**
 * Builds a CSV that opens correctly in Excel for the given locale: Turkish
 * uses ";" as separator and "," as decimal mark, English uses "," and ".".
 * A UTF-8 BOM keeps Turkish letters intact in Excel.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], locale: 'tr' | 'en'): string {
  const sep = locale === 'tr' ? ';' : ','
  const cell = (v: string | number) => {
    const text = typeof v === 'number' ? (locale === 'tr' ? v.toFixed(2).replace('.', ',') : v.toFixed(2)) : v
    const needsQuotes = text.includes(sep) || /["\n\r]/.test(text)
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [columns.map((c) => cell(c.header)).join(sep), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(sep))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function downloadText(content: string, fileName: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
