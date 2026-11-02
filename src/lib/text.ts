const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'I',
  ş: 's',
  Ş: 'S',
  ğ: 'g',
  Ğ: 'G',
  ü: 'u',
  Ü: 'U',
  ö: 'o',
  Ö: 'O',
  ç: 'c',
  Ç: 'C',
  â: 'a',
  Â: 'A',
  î: 'i',
  Î: 'I',
  û: 'u',
  Û: 'U',
}

const FOLD_RE = /[ıİşŞğĞüÜöÖçÇâÂîÎûÛ]/g

/** Replaces Turkish letters with their ASCII base letters, keeping case. */
export function foldDiacritics(value: string): string {
  return value.replace(FOLD_RE, (ch) => TURKISH_FOLD[ch] ?? ch)
}

/**
 * Case and diacritic insensitive key used for matching bank descriptions.
 * Bank exports mix "MİGROS", "MIGROS" and "Migros"; all fold to "MIGROS".
 */
export function foldForMatch(value: string): string {
  return foldDiacritics(value).toUpperCase().replace(/\s+/g, ' ').trim()
}

/** 53-bit string hash (cyrb53). Fast, stable and good enough for dedupe keys. */
export function hashString(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return n.toString(36)
}
