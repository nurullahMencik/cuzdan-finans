import type { Account, Budget, CurrencyCode, FxRate, Rule, Transaction } from '../../domain/types'
import { transactionHash } from '../csv/build'
import { addDays, addMonthsToMonth, daysInMonth, diffDays, monthOf, monthRange, toIsoDate } from '../dates'
import { normalizeMerchant } from '../merchant'
import { categorize, sortRules } from '../rules'
import { Random } from './rng'
import { createDefaultRules } from './rules'

export const SAMPLE_SEED = 20_261_102

export interface SampleData {
  accounts: Account[]
  transactions: Transaction[]
  rules: Rule[]
  budgets: Budget[]
  fxRates: FxRate[]
}

interface RawTx {
  accountId: string
  date: string
  description: string
  amount: number
  currency: CurrencyCode
}

export const ACCOUNT_IDS = {
  checking: 'acc-checking',
  card: 'acc-card',
  usd: 'acc-usd',
} as const

/** Islamic holidays move ~11 days a year; dates are the first day of each. */
const RAMADAN_FEAST = ['2025-03-30', '2026-03-20', '2027-03-10', '2028-02-27', '2029-02-15', '2030-02-05']
const SACRIFICE_FEAST = ['2025-06-06', '2026-05-27', '2027-05-16', '2028-05-05', '2029-04-24', '2030-04-13']

const USD_NOW = 48.4
const EUR_PER_USD = 1.16
const MONTHLY_DEPRECIATION = 0.013
/** Prices are written at today's level and deflated ~2% per month back in time. */
const MONTHLY_INFLATION = 0.021

/**
 * Builds twelve months (plus the current month to date) of realistic Turkish
 * personal-finance activity, relative to `today`. Deterministic: the same
 * date and seed always produce the same data.
 */
export function generateSampleData(today: Date, seed = SAMPLE_SEED): SampleData {
  const rng = new Random(seed)
  const end = toIsoDate(today)
  const endMonth = monthOf(end)
  const startMonth = addMonthsToMonth(endMonth, -12)
  const start = `${startMonth}-01`
  const createdAt = `${start}T09:00:00.000Z`
  const months = monthRange(endMonth, 13)

  const raw: RawTx[] = []
  const add = (accountId: string, date: string, description: string, amount: number, currency: CurrencyCode = 'TRY') => {
    if (date < start || date > end) return
    raw.push({ accountId, date, description, amount: Math.round(amount * 100) / 100, currency })
  }
  const card = (date: string, description: string, amount: number) => add(ACCOUNT_IDS.card, date, description, -amount)
  const checking = (date: string, description: string, amount: number) => add(ACCOUNT_IDS.checking, date, description, amount)
  const usd = (date: string, description: string, amount: number) => add(ACCOUNT_IDS.usd, date, description, amount, 'USD')

  const monthIndex = (iso: string) => months.indexOf(monthOf(iso))
  const priceLevel = (iso: string) => Math.pow(1 + MONTHLY_INFLATION, monthIndex(iso) - (months.length - 1))
  const usdRate = (month: string) => {
    const back = months.length - 1 - months.indexOf(month)
    return Math.round((USD_NOW / Math.pow(1 + MONTHLY_DEPRECIATION, back)) * 100) / 100
  }
  const day = (month: string, d: number) => `${month}-${String(Math.min(d, daysInMonth(month))).padStart(2, '0')}`
  const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()
  /** Moves weekend dates to the next Monday, like automatic payments do. */
  const businessDay = (iso: string) => {
    const w = weekday(iso)
    return w === 6 ? addDays(iso, 2) : w === 0 ? addDays(iso, 1) : iso
  }

  // ---- Salary with the usual January and July raises -----------------------
  const raises = new Map<number, number>([
    [1, 1.25],
    [7, 1.12],
  ])
  let salary = 105_000
  for (let i = months.length - 1; i > 0; i--) {
    const m = Number(months[i]?.slice(5, 7))
    salary /= raises.get(m) ?? 1
  }
  for (const month of months) {
    const m = Number(month.slice(5, 7))
    if (month !== months[0]) salary *= raises.get(m) ?? 1
    checking(businessDay(day(month, 1)), 'EFT MAAS ODEMESI ANADOLU YAZILIM AS', Math.round(salary / 50) * 50)
  }

  // ---- Fixed monthly payments ----------------------------------------------
  const priceHikeMonth = months[6] ?? endMonth
  for (const month of months) {
    const m = Number(month.slice(5, 7))
    checking(businessDay(day(month, 2)), 'FAST GİDEN KİRA ÖDEMESİ MEHMET KAYA', -27_500)

    const summer = m >= 6 && m <= 9
    const winter = m === 12 || m <= 2
    const electricity = 640 * (m === 7 || m === 8 ? 1.65 : summer ? 1.25 : winter ? 1.2 : 1)
    checking(businessDay(day(month, 12)), 'OTOMATIK ODEME ENERJISA ELEKTRIK 4001234567', -rng.jitter(electricity * priceLevel(day(month, 12)), 0.12))
    checking(businessDay(day(month, 18)), 'OTOMATIK ODEME ISKI SU 4400118822', -rng.jitter(380 * priceLevel(day(month, 18)), 0.3))
    const gas = winter ? 3_350 : m === 3 || m === 11 ? 1_950 : m === 4 || m === 10 ? 880 : 340
    checking(businessDay(day(month, 20)), 'OTOMATIK ODEME IGDAS DOGALGAZ 1002233445', -rng.jitter(gas * priceLevel(day(month, 20)), 0.3))
    checking(businessDay(day(month, 8)), 'OTOMATIK ODEME TURK TELEKOM INTERNET 2164441122', month < priceHikeMonth ? -549.9 : -599.9)
    checking(businessDay(day(month, 10)), 'OTOMATIK ODEME TURKCELL FATURA 5321112233', -(month < priceHikeMonth ? 489 : 529) - (rng.chance(0.25) ? rng.amount(20, 90) : 0))

    // Subscriptions on the credit card.
    card(day(month, 7), 'POS NETFLIX.COM 4589 ISTANBUL', month < priceHikeMonth ? 209.99 : 229.99)
    card(day(month, 12), 'SPOTIFY P2C3D4E5F6 STOCKHOLM SE', month < (months[4] ?? endMonth) ? 89.99 : 99.99)
    card(day(month, 20), 'GOOGLE *YOUTUBE PREMIUM G.CO/HELPPAY US', 79.99)
    card(day(month, 25), 'APPLE.COM/BILL 0800 IRELAND', 129.99)
    // Gym membership frozen for the summer holiday month.
    if (m !== 8) card(day(month, 1), 'POS MACFIT SPOR KULUBU 0021 ATASEHIR', 2_400)
    // Streaming service cancelled four months before today.
    if (month < addMonthsToMonth(endMonth, -4)) card(day(month, 16), 'DISNEYPLUS AMSTERDAM NL', 134.99)

    // USD account: currency purchase and developer tools.
    const fxDate = businessDay(day(month, 3))
    const buyUsd = 250
    checking(fxDate, 'DÖVİZ ALIŞ USD HESABINA', -Math.round(buyUsd * usdRate(month) * 1.004 * 100) / 100)
    usd(fxDate, 'DÖVİZ ALIŞ TL HESABINDAN', buyUsd)
    usd(day(month, 14), 'GITHUB, INC. SAN FRANCISCO US', -10)
    usd(day(month, 22), 'AWS EMEA AWS.AMAZON.COM LU', -rng.amount(4.8, 5.4))
    if (monthIndex(day(month, 1)) % 3 === 1) {
      usd(day(month, rng.int(9, 16)), 'SWIFT GELEN HAVALE BRIGHTLANE STUDIO LLC', rng.int(5, 9) * 50)
    }

    // ATM withdrawals and transfers between friends.
    for (let i = 0; i < 2; i++) checking(day(month, rng.int(1, 28)), `ATM PARA CEKME ${rng.pick(['1043 KADIKOY', '2210 ATASEHIR', '0871 BESIKTAS'])}`, -rng.int(2, 6) * 500)
    checking(day(month, rng.int(1, 28)), `FAST GİDEN ${rng.pick(['AYŞE DEMİR', 'EMRE ÇELİK', 'ZEYNEP ARSLAN'])} YEMEK PAYI`, -rng.int(3, 12) * 100)
    if (rng.chance(0.5)) checking(day(month, rng.int(1, 28)), `FAST GELEN ${rng.pick(['MERT ÖZTÜRK', 'ELİF ŞAHİN'])} BORÇ İADE`, rng.int(2, 10) * 100)
  }

  // Yearly developer tool licence, billed on the first day of the window and renewed a year later.
  usd(start, 'JETBRAINS S.R.O. PRAGUE CZ', -169)
  usd(addDays(start, 365), 'JETBRAINS S.R.O. PRAGUE CZ', -179)

  // ---- Daily card spending ---------------------------------------------------
  const vacationStart = summerVacation(months, rng)
  const vacationEnd = addDays(vacationStart, 7)
  const bayramWindows = [...RAMADAN_FEAST, ...SACRIFICE_FEAST]
  const nearBayram = (iso: string) => bayramWindows.some((b) => diffDays(b, iso) >= 0 && diffDays(b, iso) <= 10)
  const blackFriday = lastFridayOfNovember(months)

  let nextTopUp = addDays(start, rng.int(1, 5))
  let nextFuel = addDays(start, rng.int(2, 9))
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const level = priceLevel(date)
    const w = weekday(date)
    const workday = w >= 1 && w <= 5
    const onVacation = date >= vacationStart && date < vacationEnd
    const price = (min: number, max: number) => rng.amount(min * level, max * level)

    if (onVacation) {
      card(date, rng.pick(['POS İSKELE BALIK RESTORAN BODRUM', 'POS GÜMBET MEYHANE BODRUM', 'POS LIMAN KAFE BODRUM']), price(650, 2_400))
      if (rng.chance(0.7)) card(date, 'POS MIGROS 8821 BODRUM', price(180, 900))
      if (rng.chance(0.4)) card(date, 'POS BODRUM PLAJ HİZMETLERİ', price(400, 1_200))
      continue
    }

    // Groceries
    if (rng.chance(0.3)) card(date, `POS MIGROS ${rng.pick(['4567 ISTANBUL', '2210 KADIKOY', '3381 ATASEHIR'])}`, price(260, 2_100))
    if (rng.chance(0.22)) card(date, 'POS A101 YENI MAGAZACILIK 7788 IST', price(70, 520))
    if (rng.chance(0.2)) card(date, 'POS BIM BIRLESIK MAGAZALAR 1234 IST', price(60, 480))
    if (rng.chance(0.18)) card(date, 'POS SOK MARKETLER 0042 USKUDAR', price(45, 340))
    if (rng.chance(0.6)) card(date, 'POS ANADOLU FIRINI 0021 KADIKÖY', price(20, 85))
    if (rng.chance(0.14)) card(date, 'POS YEŞİL MANAV 0005 KADIKÖY', price(90, 420))
    if (rng.chance(0.38)) card(date, 'POS HAYDARPAŞA TEKEL BÜFE KADIKÖY', price(35, 180))

    // Eating out and delivery
    if (rng.chance(0.28)) card(date, 'IYZICO*YEMEKSEPETI 4471 ISTANBUL', price(230, 680))
    if (rng.chance(0.18)) card(date, 'POS GETIR PERAKENDE 0001 IST', price(160, 620))
    if (workday && rng.chance(0.55)) card(date, 'POS OFİS KAFETERYA 0003 ATAŞEHİR', price(30, 95))
    if (workday && rng.chance(0.5)) card(date, `POS ${rng.pick(['ESNAF LOKANTASI 0088 ATAŞEHİR', 'USTA DÖNERCİ 0034 ATAŞEHİR', 'KARADENİZ PİDE LOKANTASI'])}`, price(190, 360))
    if (rng.chance(0.36)) card(date, `POS ${rng.pick(['STARBUCKS 0123 KADIKOY', 'KAHVE DUNYASI 0456 BESIKTAS'])}`, price(95, 260))
    if (rng.chance(0.3)) card(date, 'POS SIMIT SARAYI 0789 KADIKOY', price(45, 140))
    if ((w === 5 || w === 6) && rng.chance(0.38)) {
      card(date, `POS ${rng.pick(['MAVI MEYHANE BEYOGLU', 'LEZZET KEBAP SALONU KADIKOY', 'MODA BALIK RESTORAN KADIKÖY', 'KÖFTECİ ARİF 0012 İSTANBUL'])}`, price(450, 1_800))
    }

    // Transport
    if (date >= nextTopUp) {
      card(date, 'BELBIM ISTANBULKART DOLUM 001234', rng.pick([100, 200, 200, 300, 500]))
      nextTopUp = addDays(date, rng.int(2, 7))
    }
    if (date >= nextFuel) {
      card(date, `POS ${rng.pick(['SHELL 0456 ISTANBUL', 'OPET 1188 ISTANBUL', 'BP 0021 ISTANBUL'])}`, price(1_150, 2_450))
      nextFuel = addDays(date, rng.int(8, 14))
    }
    if (rng.chance(0.08)) card(date, 'BITAKSI ISTANBUL', price(180, 650))
    if (rng.chance(0.04)) card(date, 'ISPARK OTOPARK 0012 ISTANBUL', price(60, 180))

    // Weekly five-a-side football (Wednesday), skipped on holidays.
    if (w === 3) card(date, 'POS ARENA HALI SAHA 0007 KADIKÖY', 350)

    // Shopping, with spikes before bayram, on Black Friday and before New Year.
    const festive = nearBayram(date)
    const newYear = date.slice(5, 7) === '12' && Number(date.slice(8, 10)) >= 15
    if (rng.chance(festive || newYear ? 0.35 : 0.07)) card(date, 'TRENDYOL.COM ISTANBUL', price(190, festive || newYear ? 3_400 : 2_600))
    if (rng.chance(festive || newYear ? 0.18 : 0.04)) card(date, 'HEPSIBURADA.COM ISTANBUL', price(250, 4_500))
    if (festive && rng.chance(0.3)) card(date, `POS ${rng.pick(['LC WAIKIKI 0234 ISTANBUL', 'DEFACTO 0412 KADIKOY', 'KOTON 0088 ATASEHIR'])}`, price(600, 3_200))
    if (festive && rng.chance(0.25)) card(date, `POS ${rng.pick(['HACI BEKIR 0003 KADIKOY', 'KOSKA HELVACISI 0019 ISTANBUL'])}`, price(350, 1_100))
    if (date === blackFriday) {
      card(date, 'HEPSIBURADA.COM ISTANBUL', price(11_500, 14_000))
      card(date, 'TRENDYOL.COM ISTANBUL', price(1_800, 3_200))
    }

    // Health, entertainment and the rest
    if (rng.chance(0.045)) card(date, `POS ${rng.pick(['SIFA ECZANESI 0012 KADIKOY', 'NOVA ECZANESI ATASEHIR'])}`, price(85, 650))
    if (rng.chance(0.004)) card(date, 'POS ACIBADEM HASTANESİ ATAŞEHİR', price(1_500, 3_200))
    if ((w === 5 || w === 6 || w === 0) && rng.chance(0.08)) card(date, 'POS CINEMAXIMUM 0001 ISTANBUL', price(380, 720))
    if (rng.chance(0.01)) card(date, 'BILETIX ISTANBUL', price(900, 2_600))
    if (rng.chance(0.012)) card(date, 'UDEMY ONLINE COURSES SAN FRANCISCO', price(299, 599))
    if (rng.chance(0.012)) card(date, 'POS KITAPYURDU 552211 ISTANBUL', price(180, 650))
    if (rng.chance(0.07)) card(date, `POS ${rng.pick(['GRATIS 0123 KADIKOY', 'WATSONS 0456 ATASEHIR'])}`, price(90, 650))
    if (rng.chance(0.035)) card(date, 'POS KUAFÖR ERKAN 004512 KADIKÖY', price(450, 650))
  }

  // Holiday bookings made weeks in advance; bus tickets home before Kurban Bayramı.
  card(addDays(vacationStart, -45), 'PEGASUS HAVA TASIMACILIGI IST', 2 * 2_450 * priceLevel(vacationStart))
  card(addDays(vacationStart, -32), 'ETSTUR ONLINE ISTANBUL', 18_500 * priceLevel(vacationStart))
  card(addDays(vacationStart, 1), 'POS EGE OTO KİRALAMA BODRUM', 4_800 * priceLevel(vacationStart))
  for (const feast of SACRIFICE_FEAST) card(addDays(feast, -12), 'OBILET.COM ISTANBUL', 2 * 950 * priceLevel(feast))

  // ---- Card statement paid from the checking account on the 5th ----------------
  for (const month of months) {
    const prev = addMonthsToMonth(month, -1)
    const spent =
      month === startMonth
        ? 12_400
        : -raw
            .filter((t) => t.accountId === ACCOUNT_IDS.card && t.amount < 0 && monthOf(t.date) === prev)
            .reduce((s, t) => s + t.amount, 0)
    const payDate = businessDay(day(month, 5))
    checking(payDate, 'KREDİ KARTI BORÇ ÖDEMESİ', -spent)
    add(ACCOUNT_IDS.card, payDate, 'ODEME - TESEKKURLER', spent)
  }

  const rules = createDefaultRules(createdAt)
  const sorted = sortRules(rules)
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.accountId.localeCompare(b.accountId))
  const transactions = raw.map((r, i): Transaction => {
    const merchant = normalizeMerchant(r.description)
    const base = { ...r, merchant: merchant.name, merchantKey: merchant.key }
    return {
      ...base,
      id: `seed-${String(i).padStart(5, '0')}`,
      hash: transactionHash(r.date, r.amount, r.description),
      ...categorize(base, sorted),
    }
  })

  const accounts: Account[] = [
    { id: ACCOUNT_IDS.checking, name: 'Vadesiz TL', type: 'checking', currency: 'TRY', openingBalance: 48_250, createdAt },
    { id: ACCOUNT_IDS.card, name: 'Kredi Kartı', type: 'credit', currency: 'TRY', openingBalance: -12_400, createdAt },
    { id: ACCOUNT_IDS.usd, name: 'USD Hesabı', type: 'fx', currency: 'USD', openingBalance: 1_850, createdAt },
  ]

  const budgets: Budget[] = [
    { categoryId: 'groceries', amount: 16_500 },
    { categoryId: 'dining', amount: 15_000 },
    { categoryId: 'transport', amount: 7_000 },
    { categoryId: 'shopping', amount: 6_000 },
    { categoryId: 'subscriptions', amount: 4_000 },
    { categoryId: 'utilities', amount: 4_500 },
    { categoryId: 'entertainment', amount: 3_000 },
    { categoryId: 'health', amount: 1_000 },
  ]

  const fxRates: FxRate[] = months.map((month) => {
    const rate = usdRate(month)
    return { month, USD: rate, EUR: Math.round(rate * EUR_PER_USD * 100) / 100 }
  })

  return { accounts, transactions, rules, budgets, fxRates }
}

/** A week in mid August (the gym membership is frozen that month). */
function summerVacation(months: readonly string[], rng: Random): string {
  const candidates = months.filter((m) => m.endsWith('-08'))
  const month = candidates.length > 0 ? rng.pick(candidates) : (months[0] ?? '2026-07')
  return `${month}-${String(rng.int(8, 16)).padStart(2, '0')}`
}

function lastFridayOfNovember(months: readonly string[]): string {
  const nov = months.find((m) => m.endsWith('-11'))
  if (!nov) return ''
  for (let d = 30; d >= 24; d--) {
    const iso = `${nov}-${d}`
    if (new Date(`${iso}T12:00:00Z`).getUTCDay() === 5) return iso
  }
  return ''
}
