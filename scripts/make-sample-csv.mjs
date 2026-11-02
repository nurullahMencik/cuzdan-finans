// Generates public/ornek-ekstre.csv: a statement in the format Turkish banks
// commonly export (Windows-1254, ";" separated, "1.234,56" numbers, a few
// note lines above the header, a balance column and a closing total line).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rows = [
  ['01.10.2026', 'EFT MAAŞ ÖDEMESİ ANADOLU YAZILIM A.Ş.', 0, 105000],
  ['02.10.2026', 'FAST GİDEN KİRA ÖDEMESİ MEHMET KAYA', 27500, 0],
  ['03.10.2026', 'POS MİGROS 4567 KADIKÖY', 1284.35, 0],
  ['03.10.2026', 'POS SİMİT SARAYI 0789 KADIKÖY', 92.5, 0],
  ['04.10.2026', 'POS ŞOK MARKETLER 0042 ÜSKÜDAR', 186.4, 0],
  ['05.10.2026', 'BELBİM İSTANBULKART DOLUM 001234', 300, 0],
  ['06.10.2026', 'POS LALE ÇİÇEKÇİLİK 0031 BEŞİKTAŞ', 640, 0],
  ['07.10.2026', 'IYZICO*YEMEKSEPETI 4471 ISTANBUL', 418.9, 0],
  ['08.10.2026', 'OTOMATİK ÖDEME TÜRK TELEKOM İNTERNET', 599.9, 0],
  ['09.10.2026', 'POS BİM BİRLEŞİK MAĞAZALAR 1234 İST', 352.75, 0],
  ['10.10.2026', 'ATM PARA ÇEKME 1043 KADIKÖY', 2000, 0],
  ['11.10.2026', 'POS KAHVE DÜNYASI 0456 BEŞİKTAŞ', 186, 0],
  ['12.10.2026', 'OTOMATİK ÖDEME ENERJİSA ELEKTRİK', 812.44, 0],
  ['13.10.2026', 'FAST GELEN ELİF ŞAHİN BORÇ İADE', 0, 750],
  ['14.10.2026', 'POS OPET 1188 İSTANBUL', 1985.6, 0],
  ['15.10.2026', 'TRENDYOL.COM İSTANBUL', 1249.99, 0],
  ['16.10.2026', 'POS A101 YENİ MAĞAZACILIK 7788 İST', 214.3, 0],
  ['17.10.2026', 'POS GÜVEN ECZANESİ 0018 MODA', 356.8, 0],
  ['18.10.2026', 'OTOMATİK ÖDEME İSKİ SU', 402.15, 0],
  ['19.10.2026', 'POS CINEMAXIMUM 0001 İSTANBUL', 560, 0],
  ['20.10.2026', 'OTOMATİK ÖDEME İGDAŞ DOĞALGAZ', 936.2, 0],
  ['21.10.2026', 'POS MİGROS 2210 KADIKÖY', 967.1, 0],
  ['22.10.2026', 'POS KUAFÖR ERKAN 004512 KADIKÖY', 550, 0],
  ['24.10.2026', 'IYZICO*YEMEKSEPETI 4471 ISTANBUL', 365.4, 0],
  ['25.10.2026', 'POS GETIR PERAKENDE 0001 IST', 289.95, 0],
  ['27.10.2026', 'HEPSIBURADA.COM İSTANBUL', 3499, 0],
  ['28.10.2026', 'POS ANADOLU FIRINI 0021 KADIKÖY', 64.5, 0],
  ['29.10.2026', 'SWIFT GELEN HAVALE BRIGHTLANE STUDIO LLC', 0, 14520],
  ['30.10.2026', 'POS SİMİT SARAYI 0789 KADIKÖY', 78, 0],
  ['31.10.2026', 'POS ŞOK MARKETLER 0042 ÜSKÜDAR', 241.6, 0],
]

const tr = (n) =>
  n === 0
    ? ''
    : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

let balance = 18450.75
const lines = [
  'HESAP HAREKETLERİ',
  'Müşteri;Ayşe Yılmaz',
  'IBAN;TR00 0000 0000 0000 0000 0000 00',
  'Dönem;01.10.2026 - 31.10.2026',
  '',
  'Tarih;Açıklama;Borç;Alacak;Bakiye',
]
for (const [date, description, debit, credit] of rows) {
  balance = Math.round((balance - debit + credit) * 100) / 100
  lines.push([date, description, tr(debit), tr(credit), tr(balance)].join(';'))
}
lines.push(`Dönem sonu bakiyesi;;;;${tr(balance)}`)
const text = `${lines.join('\r\n')}\r\n`

// Windows-1254: ASCII plus the Turkish letters at their code page positions.
const CP1254 = { Ç: 0xc7, ç: 0xe7, Ğ: 0xd0, ğ: 0xf0, İ: 0xdd, ı: 0xfd, Ö: 0xd6, ö: 0xf6, Ş: 0xde, ş: 0xfe, Ü: 0xdc, ü: 0xfc }
const bytes = Uint8Array.from([...text].map((ch) => {
  const code = CP1254[ch] ?? ch.charCodeAt(0)
  if (code > 0x7f && CP1254[ch] === undefined) throw new Error(`Cannot encode ${ch}`)
  return code
}))

const out = fileURLToPath(new URL('../public/ornek-ekstre.csv', import.meta.url))
writeFileSync(out, bytes)
console.log(`Wrote ${rows.length} rows (${bytes.length} bytes) to ${out}`)
