export type TextEncodingName = 'utf-8' | 'windows-1254'

export interface DecodedText {
  text: string
  encoding: TextEncodingName
  hadBom: boolean
}

/**
 * Decodes a bank export. Turkish banks commonly export Windows-1254
 * ("Turkish ANSI"), where ş/ğ/ı/İ live in single bytes that are invalid
 * UTF-8 sequences. Strategy:
 *  1. A UTF-8 BOM settles it.
 *  2. Strict UTF-8 decoding; any invalid sequence throws.
 *  3. Fall back to Windows-1254, which maps every byte.
 */
export function decodeBankFile(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8', hadBom: true }
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, encoding: 'utf-8', hadBom: false }
  } catch {
    return { text: new TextDecoder('windows-1254').decode(bytes), encoding: 'windows-1254', hadBom: false }
  }
}

export function decodeWith(bytes: Uint8Array, encoding: TextEncodingName): string {
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return new TextDecoder(encoding).decode(hasBom ? bytes.subarray(3) : bytes)
}
