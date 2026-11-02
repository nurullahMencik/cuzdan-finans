import { foldDiacritics, foldForMatch } from './text'

export interface NormalizedMerchant {
  /** Display name, e.g. "Netflix". */
  name: string
  /** Grouping key, e.g. "netflix". */
  key: string
}

interface KnownMerchant {
  pattern: RegExp
  name: string
}

/**
 * Well-known merchants. Patterns run against the folded (ASCII, upper-case)
 * description, so "BİM" and "BIM" both match /\bBIM\b/.
 */
const KNOWN_MERCHANTS: readonly KnownMerchant[] = [
  { pattern: /NETFLIX/, name: 'Netflix' },
  { pattern: /SPOTIFY/, name: 'Spotify' },
  { pattern: /YOUTUBE|GOOGLE \*YOUTUBE/, name: 'YouTube Premium' },
  { pattern: /APPLE\.COM\/BILL|ICLOUD/, name: 'iCloud+' },
  { pattern: /GOOGLE ?ONE/, name: 'Google One' },
  { pattern: /DISNEY ?PLUS|DISNEYPLUS/, name: 'Disney+' },
  { pattern: /AMAZON ?PRIME|PRIMEVIDEO/, name: 'Amazon Prime' },
  { pattern: /GITHUB/, name: 'GitHub' },
  { pattern: /JETBRAINS/, name: 'JetBrains' },
  { pattern: /MICROSOFT|MSFT/, name: 'Microsoft 365' },
  { pattern: /MACFIT/, name: 'MACFit' },
  { pattern: /MIGROS|MACROCENTER/, name: 'Migros' },
  { pattern: /\bA ?101\b/, name: 'A101' },
  { pattern: /\bBIM\b/, name: 'BİM' },
  { pattern: /\bSOK\b/, name: 'ŞOK' },
  { pattern: /CARREFOUR/, name: 'CarrefourSA' },
  { pattern: /YEMEKSEPETI|YEMEK SEPETI/, name: 'Yemeksepeti' },
  { pattern: /GETIR/, name: 'Getir' },
  { pattern: /TRENDYOL/, name: 'Trendyol' },
  { pattern: /HEPSIBURADA|D-MARKET/, name: 'Hepsiburada' },

  { pattern: /ISTANBULKART|BELBIM/, name: 'İstanbulkart' },
  { pattern: /\bSHELL\b/, name: 'Shell' },
  { pattern: /\bOPET\b/, name: 'Opet' },
  { pattern: /PETROL OFISI/, name: 'Petrol Ofisi' },
  { pattern: /\bBP\b/, name: 'BP' },
  { pattern: /BITAKSI/, name: 'BiTaksi' },
  { pattern: /ISPARK/, name: 'İSPARK' },
  { pattern: /ENERJISA|CK BOGAZICI|BOGAZICI ELEKTRIK/, name: 'Elektrik faturası' },
  { pattern: /\bISKI\b/, name: 'İSKİ' },
  { pattern: /IGDAS/, name: 'İGDAŞ' },
  { pattern: /TURK ?TELEKOM|TTNET/, name: 'Türk Telekom' },
  { pattern: /SUPERONLINE/, name: 'Superonline' },
  { pattern: /TURKCELL/, name: 'Turkcell' },
  { pattern: /VODAFONE/, name: 'Vodafone' },
  { pattern: /STARBUCKS/, name: 'Starbucks' },
  { pattern: /KAHVE DUNYASI/, name: 'Kahve Dünyası' },
  { pattern: /SIMIT SARAYI/, name: 'Simit Sarayı' },
  { pattern: /PEGASUS/, name: 'Pegasus' },
  { pattern: /\bTHY\b|TURK HAVA YOLLARI/, name: 'Türk Hava Yolları' },
  { pattern: /BOOKING\.COM/, name: 'Booking.com' },
  { pattern: /ETSTUR/, name: 'Etstur' },
  { pattern: /OBILET/, name: 'obilet' },
  { pattern: /LC ?WAIKIKI/, name: 'LC Waikiki' },
  { pattern: /DEFACTO/, name: 'DeFacto' },
  { pattern: /KOTON/, name: 'Koton' },
  { pattern: /HACI BEKIR/, name: 'Hacı Bekir' },
  { pattern: /KOSKA/, name: 'Koska' },
  { pattern: /CINEMAXIMUM/, name: 'Cinemaximum' },
  { pattern: /BILETIX/, name: 'Biletix' },
  { pattern: /UDEMY/, name: 'Udemy' },
  { pattern: /\bAWS\b|AMAZON WEB SERVICES/, name: 'AWS' },
  { pattern: /AMAZON/, name: 'Amazon' },
  { pattern: /ECZANE|ECZ\b/, name: 'Eczane' },
  { pattern: /KREDI KARTI BORC/, name: 'Kart borcu ödemesi' },
  { pattern: /ODEME - TESEKKUR/, name: 'Kart ödemesi' },
  { pattern: /\bMAAS\b/, name: 'Maaş' },
  { pattern: /\bKIRA\b/, name: 'Kira' },
  { pattern: /\bATM\b/, name: 'ATM' },
]

/** Transaction-type prefixes that banks prepend to the merchant. */
const PREFIXES = [
  'SANAL POS',
  'POS SATIS',
  'POS ISLEMI',
  'POS',
  'KK ODEME',
  'KREDI KARTI',
  'INTERNET ALISVERIS',
  'ONLINE ALISVERIS',
  'ALISVERIS',
  'OTOMATIK ODEME',
  'OTOM ODEME',
  'FATURA ODEME',
  'EFT GELEN',
  'EFT GIDEN',
  'FAST GELEN',
  'FAST GIDEN',
  'HAVALE GELEN',
  'HAVALE GIDEN',
  'EFT',
  'FAST',
  'HAVALE',
  'TAKSITLI',
  'YURTDISI',
  'IYZICO',
  'PAYTR',
  'PAYU',
  'PARAM',
  'SWIFT GELEN',
  'SWIFT GIDEN',
  'SWIFT',
]

const CITIES = [
  'ISTANBUL',
  'IST',
  'ANKARA',
  'IZMIR',
  'BURSA',
  'ANTALYA',
  'KONYA',
  'ADANA',
  'BODRUM',
  'MUGLA',
  'KADIKOY',
  'BESIKTAS',
  'SISLI',
  'USKUDAR',
  'ATASEHIR',
  'MALTEPE',
  'BAKIRKOY',
  'BEYOGLU',
  'KARTAL',
  'PENDIK',
  'UMRANIYE',
  'LONDON',
  'DUBLIN',
  'AMSTERDAM',
  'LUXEMBOURG',
  'PRAGUE',
  'SAN FRANCISCO',
  'SEATTLE',
  'CUPERTINO',
  'TR',
  'TUR',
  'TURKEY',
  'TURKIYE',
  'US',
  'USA',
  'IE',
  'NL',
  'CZ',
  'GB',
  'LU',
]

const CITY_RE = new RegExp(`\\b(?:${CITIES.map((c) => c.replace(/ /g, '\\s+')).join('|')})\\b`, 'g')
const PREFIX_RE = new RegExp(`^\\s*(?:${PREFIXES.join('|')})\\b[\\s\\-:*/]*`)

/** Regexes whose matches are blanked out of the description, in order. */
const NOISE: readonly RegExp[] = [
  /\b[A-Z0-9]+\*/g, // payment processor prefixes such as "IYZICO*" or "SP*"
  /\*/g,
  /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, // dates
  /\b(?:REF|REFNO|NO|TERM|TRM|ISL|ISLEM)[:.]?\s*\S+/g, // reference numbers
  /[A-Z0-9]*\d{3,}[A-Z0-9]*/g, // card, terminal and order numbers
  /\.(?:COM|NET|ORG|IO)(?:\.TR)?\b/g,
  /\bWWW\./g,
  CITY_RE,
  /\b(?:A\.?S|LTD|STI|SAN|TIC|VE|LIMITED|LLC|INC|GMBH|SIRKETI|SUBESI|MAGAZASI|MAGAZACILIK)\b\.?/g,
  /[^A-Z0-9&' -]/g,
]

const blank = (match: string) => ' '.repeat(match.length)

/**
 * Turns a raw statement line into a stable merchant identity:
 * "POS NETFLIX.COM 4589 ISTANBUL" → { name: "Netflix", key: "netflix" }.
 *
 * 1. Fold Turkish letters and case so "MİGROS", "Migros" and "MIGROS" agree.
 * 2. Match a dictionary of well-known merchants.
 * 3. Otherwise blank out transaction-type prefixes, payment processors,
 *    card/terminal numbers, dates, domains, legal suffixes and city/country
 *    tokens. Blanking keeps string positions aligned with the original text,
 *    so the surviving words can be read back with their Turkish letters.
 * 4. Keep the first three words, title-cased.
 */
export function normalizeMerchant(description: string): NormalizedMerchant {
  const source = description.replace(/\s+/g, ' ').trim()
  const folded = foldDiacritics(source).toUpperCase()
  for (const known of KNOWN_MERCHANTS) {
    if (known.pattern.test(folded)) {
      return { name: known.name, key: toKey(known.name) }
    }
  }

  let work = folded
  // Strip up to three stacked prefixes ("EFT GIDEN FAST ...").
  for (let i = 0; i < 3; i++) {
    const next = work.replace(PREFIX_RE, blank)
    if (next === work) break
    work = next
  }
  for (const re of NOISE) work = work.replace(re, blank)

  const aligned = work.length === source.length
  let kept = ''
  for (let i = 0; i < work.length; i++) {
    const ch = work[i] ?? ' '
    kept += ch === ' ' ? ' ' : aligned ? (source[i] ?? ch) : ch
  }

  const words = kept
    .split(' ')
    .map((w) => w.replace(/^[-'&]+|[-'&]+$/g, ''))
    .filter((w) => w.length > 1)
  // Exports that keep Turkish capitals (İ, Ş, Ğ...) use I for the dotless ı;
  // ASCII-only exports use I for both, where "i" is the better guess.
  const turkishCaps = /[İŞĞÜÖÇ]/.test(source)
  const core = words
    .slice(0, 3)
    .map((w) => smartCapitalize(w, turkishCaps))
    .join(' ')
  if (!core) {
    const fallback = source.slice(0, 24).trim() || '-'
    return { name: fallback, key: toKey(fallback) }
  }
  return { name: core, key: toKey(core) }
}

/**
 * "MIGROS" → "Migros", "LOKANTASI" → "Lokantası" (Turkish capitals) or
 * "Lokantasi" (ASCII export), "AVM" and "McDonald's" stay as they are.
 */
function smartCapitalize(word: string, turkishCaps: boolean): string {
  const isUpper = word === word.toLocaleUpperCase('tr-TR') || word === word.toUpperCase()
  if (!isUpper || /^\d/.test(word) || isAcronym(word)) return word
  const rest = word.slice(1)
  if (turkishCaps) return word.charAt(0) + rest.toLocaleLowerCase('tr-TR')
  let out = word.charAt(0)
  for (const ch of rest) out += ch === 'I' ? 'i' : ch.toLocaleLowerCase('tr-TR')
  return out
}

/** "AVM", "BP", "THY", "USD" stay upper-case; "EGE" or "OTO" do not. */
function isAcronym(word: string): boolean {
  if (word.length <= 2) return true
  if (word.length > 3) return false
  return (word.match(/[AEIİOÖUÜ]/g) ?? []).length <= 1
}

function toKey(name: string): string {
  return foldForMatch(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Normalizes a description for duplicate detection (keeps digits). */
export function normalizeForHash(description: string): string {
  return foldForMatch(description).replace(/[^A-Z0-9]/g, '')
}
