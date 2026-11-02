import { describe, expect, it } from 'vitest'
import { buildRows, markDuplicates, transactionHash } from './build'
import { decodeBankFile } from './encoding'
import { detectDateFormat, detectDecimalFormat, parseAmount, parseDate } from './formats'
import { parseCsv } from './parse'
import { detectDelimiter, detectHeaderRow, guessFormats, guessMapping, NO_COLUMN } from './structure'

/** Minimal Windows-1254 encoder for fixtures (ASCII + Turkish letters). */
function encode1254(text: string): Uint8Array {
  const map: Record<string, number> = {
    Ç: 0xc7, ç: 0xe7, Ğ: 0xd0, ğ: 0xf0, İ: 0xdd, ı: 0xfd, Ö: 0xd6, ö: 0xf6, Ş: 0xde, ş: 0xfe, Ü: 0xdc, ü: 0xfc,
  }
  return Uint8Array.from([...text].map((ch) => map[ch] ?? ch.charCodeAt(0)))
}

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['-45,90', -45.9],
    ['45,90-', -45.9],
    ['(1.234,56)', -1234.56],
    ['₺1.234,56', 1234.56],
    ['1.234.567,8', 1234567.8],
    ['12 345,00 TL', 12345],
    ['+250,00', 250],
    ['0,00', 0],
    ['1.234', 1234],
  ])('parses Turkish %s', (input, expected) => {
    expect(parseAmount(input, 'tr')).toBe(expected)
  })

  it.each([
    ['1,234.56', 1234.56],
    ['-45.90', -45.9],
    ['$1,234,567.89', 1234567.89],
  ])('parses English %s', (input, expected) => {
    expect(parseAmount(input, 'en')).toBe(expected)
  })

  it.each(['', 'abc', '12,34,56', '1.23.45', '1234.56,7'])('rejects %j in Turkish format', (input) => {
    expect(parseAmount(input, 'tr')).toBeNull()
  })
})

describe('detectDecimalFormat', () => {
  it('detects Turkish decimals', () => {
    expect(detectDecimalFormat(['1.234,56', '-45,90', '120,00'])).toBe('tr')
  })
  it('detects English decimals', () => {
    expect(detectDecimalFormat(['1,234.56', '-45.90', '120.00'])).toBe('en')
  })
  it('ignores ambiguous thousands-only values and defaults to Turkish', () => {
    expect(detectDecimalFormat(['1.234', '5.000'])).toBe('tr')
    expect(detectDecimalFormat(['1,234', '45.90'])).toBe('en')
  })
})

describe('dates', () => {
  it.each([
    ['05.03.2026', 'dd.MM.yyyy', '2026-03-05'],
    ['5.3.2026', 'dd.MM.yyyy', '2026-03-05'],
    ['2026-03-05', 'yyyy-MM-dd', '2026-03-05'],
    ['05/03/2026', 'dd/MM/yyyy', '2026-03-05'],
    ['31.12.2025 23:59', 'dd.MM.yyyy', '2025-12-31'],
    ['2024-02-29', 'yyyy-MM-dd', '2024-02-29'],
  ] as const)('parses %s as %s', (input, format, expected) => {
    expect(parseDate(input, format)).toBe(expected)
  })

  it('rejects impossible dates', () => {
    expect(parseDate('31.02.2026', 'dd.MM.yyyy')).toBeNull()
    expect(parseDate('2025-02-29', 'yyyy-MM-dd')).toBeNull()
    expect(parseDate('13/13/2026', 'dd/MM/yyyy')).toBeNull()
  })

  it('detects each supported format', () => {
    expect(detectDateFormat(['01.10.2026', '15.10.2026'])).toBe('dd.MM.yyyy')
    expect(detectDateFormat(['2026-10-01', '2026-10-15'])).toBe('yyyy-MM-dd')
    expect(detectDateFormat(['01/10/2026', '15/10/2026'])).toBe('dd/MM/yyyy')
    expect(detectDateFormat(['dün', 'bugün'])).toBeNull()
  })
})

describe('decodeBankFile', () => {
  it('decodes Windows-1254 exports with Turkish letters', () => {
    const bytes = encode1254('Tarih;Açıklama;Tutar\n01.10.2026;İŞLEM ÜCRETİ ğüşıöç;-12,50\n')
    const decoded = decodeBankFile(bytes)
    expect(decoded.encoding).toBe('windows-1254')
    expect(decoded.text).toContain('Açıklama')
    expect(decoded.text).toContain('İŞLEM ÜCRETİ ğüşıöç')
  })

  it('keeps UTF-8 and strips a BOM', () => {
    const utf8 = new TextEncoder().encode('Tarih;Açıklama\n')
    expect(decodeBankFile(utf8)).toMatchObject({ encoding: 'utf-8', hadBom: false, text: 'Tarih;Açıklama\n' })
    const withBom = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8])
    expect(decodeBankFile(withBom)).toMatchObject({ encoding: 'utf-8', hadBom: true, text: 'Tarih;Açıklama\n' })
  })
})

describe('structure detection', () => {
  const turkishExport = [
    'HESAP HAREKETLERİ',
    'Müşteri: Ayşe Yılmaz;IBAN: TR00 0000 0000 0000 0000 0000 00',
    '',
    'Tarih;Açıklama;Borç;Alacak;Bakiye',
    '01.10.2026;EFT MAAS ODEMESI;;95.000,00;101.250,40',
    '02.10.2026;POS MIGROS 4567 ISTANBUL;1.234,56;;100.015,84',
    '03.10.2026;POS NETFLIX.COM 4589 ISTANBUL;229,99;;99.785,85',
  ].join('\n')

  it('detects semicolons even though commas are decimal separators', () => {
    expect(detectDelimiter(turkishExport)).toBe(';')
    expect(detectDelimiter('date,description,amount\n2026-10-01,Coffee,-4.50\n2026-10-02,Lunch,-12.00')).toBe(',')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
  })

  it('finds the header below a preamble and maps debit/credit columns', () => {
    const rows = parseCsv(turkishExport, ';')
    const headerIndex = detectHeaderRow(rows)
    expect(rows[headerIndex]).toEqual(['Tarih', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'])
    const data = rows.slice(headerIndex + 1)
    const mapping = guessMapping(rows[headerIndex] ?? [], data)
    expect(mapping).toEqual({ date: 0, description: 1, amountMode: 'split', amount: NO_COLUMN, debit: 2, credit: 3 })
    expect(guessFormats(data, mapping)).toEqual({ dateFormat: 'dd.MM.yyyy', decimalFormat: 'tr' })

    const { rows: built, errors } = buildRows(data, { mapping, dateFormat: 'dd.MM.yyyy', decimalFormat: 'tr' })
    expect(errors).toEqual([])
    expect(built.map((r) => r.amount)).toEqual([95000, -1234.56, -229.99])
    expect(built[1]?.date).toBe('2026-10-02')
  })

  it('maps a single signed amount column', () => {
    const csv = 'İşlem Tarihi,Description,Amount\n2026-10-01,Coffee,"-4.50"\n2026-10-02,Refund,12.00'
    const rows = parseCsv(csv, ',')
    const mapping = guessMapping(rows[0] ?? [], rows.slice(1))
    expect(mapping).toMatchObject({ date: 0, description: 1, amountMode: 'single', amount: 2 })
    const formats = guessFormats(rows.slice(1), mapping)
    expect(formats).toEqual({ dateFormat: 'yyyy-MM-dd', decimalFormat: 'en' })
    const { rows: built } = buildRows(rows.slice(1), { mapping, dateFormat: 'yyyy-MM-dd', decimalFormat: 'en' })
    expect(built.map((r) => r.amount)).toEqual([-4.5, 12])
  })

  it('reports rows with invalid dates or amounts', () => {
    const mapping = { date: 0, description: 1, amountMode: 'single' as const, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN }
    const { rows, errors } = buildRows(
      [
        ['01.10.2026', 'OK', '-10,00'],
        ['32.10.2026', 'Bad date', '-10,00'],
        ['02.10.2026', 'Bad amount', 'on lira'],
        ['03.10.2026', '', '-1,00'],
      ],
      { mapping, dateFormat: 'dd.MM.yyyy', decimalFormat: 'tr' },
    )
    expect(rows).toHaveLength(1)
    expect(errors.map((e) => e.reason)).toEqual(['date', 'amount', 'description'])
  })
})

describe('duplicate detection', () => {
  it('hashes date + amount + normalized description', () => {
    const a = transactionHash('2026-10-02', -1234.56, 'POS MIGROS 4567 ISTANBUL')
    expect(transactionHash('2026-10-02', -1234.56, 'pos  migros 4567 istanbul')).toBe(a)
    expect(transactionHash('2026-10-02', -1234.56, 'POS MİGROS 4567 İSTANBUL')).toBe(a)
    expect(transactionHash('2026-10-03', -1234.56, 'POS MIGROS 4567 ISTANBUL')).not.toBe(a)
    expect(transactionHash('2026-10-02', -1234.5, 'POS MIGROS 4567 ISTANBUL')).not.toBe(a)
  })

  it('counts occurrences so identical same-day purchases survive', () => {
    const h = transactionHash('2026-10-02', -45, 'SIMIT SARAYI')
    const rows = [{ hash: h }, { hash: h }, { hash: 'other' }]
    const marked = markDuplicates(rows, [h])
    expect(marked.map((m) => m.duplicate)).toEqual([true, false, false])
  })
})

describe('bundled sample statement (public/ornek-ekstre.csv)', () => {
  it('is detected and parsed end to end', async () => {
    const { readFile } = await import('node:fs/promises')
    const bytes = new Uint8Array(await readFile(new URL('../../../public/ornek-ekstre.csv', import.meta.url)))
    const decoded = decodeBankFile(bytes)
    expect(decoded.encoding).toBe('windows-1254')
    const delimiter = detectDelimiter(decoded.text)
    expect(delimiter).toBe(';')
    const rows = parseCsv(decoded.text, delimiter)
    const headerIndex = detectHeaderRow(rows)
    expect(rows[headerIndex]?.[1]).toBe('Açıklama')
    const data = rows.slice(headerIndex + 1)
    const mapping = guessMapping(rows[headerIndex] ?? [], data)
    expect(mapping.amountMode).toBe('split')
    const formats = guessFormats(data, mapping)
    expect(formats).toEqual({ dateFormat: 'dd.MM.yyyy', decimalFormat: 'tr' })
    const built = buildRows(data, { mapping, dateFormat: 'dd.MM.yyyy', decimalFormat: 'tr' })
    expect(built.rows).toHaveLength(30)
    // The closing balance line has no date and is reported, not imported.
    expect(built.errors.map((e) => e.reason)).toEqual(['date'])
    expect(built.rows[0]).toMatchObject({ date: '2026-10-01', amount: 105000, description: 'EFT MAAŞ ÖDEMESİ ANADOLU YAZILIM A.Ş.' })
  })
})
