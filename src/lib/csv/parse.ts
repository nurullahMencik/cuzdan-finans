import Papa from 'papaparse'
import type { Delimiter } from './structure'

/** Splits CSV text into trimmed string cells; blank lines are dropped. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' })
  return result.data.map((row) => row.map((cell) => cell.trim()))
}
