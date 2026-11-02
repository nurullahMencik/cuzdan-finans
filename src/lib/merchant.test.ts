import { describe, expect, it } from 'vitest'
import { normalizeMerchant } from './merchant'

describe('normalizeMerchant', () => {
  it.each([
    ['POS NETFLIX.COM 4589 ISTANBUL', 'Netflix'],
    ['NETFLIX.COM AMSTERDAM NL', 'Netflix'],
    ['SANAL POS SPOTIFY P1A2B3C4D5 STOCKHOLM', 'Spotify'],
    ['GOOGLE *YOUTUBE PREMIUM 650-253-0000 US', 'YouTube Premium'],
    ['APPLE.COM/BILL 0800 IRELAND', 'iCloud+'],
    ['POS MIGROS 4567 ISTANBUL', 'Migros'],
    ['POS MİGROS TİCARET A.Ş. KADIKÖY', 'Migros'],
    ['POS BIM BIRLESIK MAGAZALAR 1234 IST', 'BİM'],
    ['POS ŞOK MARKETLER 0042 ÜSKÜDAR', 'ŞOK'],
    ['POS A101 YENI MAGAZACILIK 7788', 'A101'],
    ['IYZICO*YEMEKSEPETI 4471 ISTANBUL', 'Yemeksepeti'],
    ['POS GETIR PERAKENDE 0001 IST', 'Getir'],
    ['BELBIM ISTANBULKART DOLUM 001234', 'İstanbulkart'],
    ['EFT MAAS ODEMESI ANADOLU YAZILIM AS', 'Maaş'],
    ['OTOMATIK ODEME IGDAS 4400112233', 'İGDAŞ'],
  ])('%s → %s', (description, expected) => {
    expect(normalizeMerchant(description).name).toBe(expected)
  })

  it('produces the same key regardless of casing and Turkish letters', () => {
    const a = normalizeMerchant('POS MİGROS 4567 İSTANBUL')
    const b = normalizeMerchant('pos migros 9999 istanbul')
    expect(a.key).toBe('migros')
    expect(b.key).toBe(a.key)
  })

  it('cleans unknown merchants: prefixes, numbers, cities and legal suffixes', () => {
    expect(normalizeMerchant('POS KUAFOR ERKAN 004512 KADIKOY').name).toBe('Kuafor Erkan')
    expect(normalizeMerchant('POS SATIS HAYDARPAŞA BÜFE 12/10 ISTANBUL TR').name).toBe('Haydarpaşa Büfe')
    expect(normalizeMerchant('IYZICO*KITAPYURDU 552211 ISTANBUL').name).toBe('Kitapyurdu')
    expect(normalizeMerchant('POS ÖZDİLEK AVM LTD. ŞTİ. BURSA').name).toBe('Özdilek AVM')
  })

  it('restores dotless ı when the export keeps Turkish capitals', () => {
    expect(normalizeMerchant('POS ESNAF LOKANTASI 0088 ATAŞEHİR').name).toBe('Esnaf Lokantası')
    expect(normalizeMerchant('POS ESNAF LOKANTASI 0088 ATASEHIR').name).toBe('Esnaf Lokantasi')
    expect(normalizeMerchant('FAST GİDEN AYŞE DEMİR YEMEK PAYI').name).toBe('Ayşe Demir Yemek')
    expect(normalizeMerchant('SWIFT GELEN HAVALE BRIGHTLANE STUDIO LLC').name).toBe('Brightlane Studio')
  })

  it('is stable for the same unknown merchant across store numbers', () => {
    const a = normalizeMerchant('POS KAHVECI USTA 0012 BESIKTAS')
    const b = normalizeMerchant('POS KAHVECI USTA 0099 KADIKOY')
    expect(a.key).toBe(b.key)
    expect(a.key).toBe('kahveci-usta')
  })
})
