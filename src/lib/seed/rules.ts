import type { Rule } from '../../domain/types'

type DefaultRule = Pick<Rule, 'type' | 'pattern' | 'categoryId' | 'direction'> & Partial<Pick<Rule, 'min' | 'max'>>

/** Starter rules. Users can edit, reorder or delete every one of them. */
const DEFAULT_RULES: readonly DefaultRule[] = [
  { type: 'contains', pattern: 'KREDİ KARTI BORÇ ÖDEMESİ', categoryId: 'transfer', direction: 'any' },
  { type: 'contains', pattern: 'ODEME - TESEKKURLER', categoryId: 'transfer', direction: 'income' },
  { type: 'regex', pattern: 'DÖVİZ (ALIŞ|SATIŞ)', categoryId: 'transfer', direction: 'any' },
  { type: 'contains', pattern: 'MAAŞ', categoryId: 'salary', direction: 'income' },
  { type: 'regex', pattern: '\\bKİRA\\b', categoryId: 'housing', direction: 'expense' },
  { type: 'regex', pattern: 'ENERJISA|ISKI|IGDAS|TURK TELEKOM|TURKCELL|VODAFONE|SUPERONLINE', categoryId: 'utilities', direction: 'expense' },
  {
    type: 'regex',
    pattern: 'NETFLIX|SPOTIFY|YOUTUBE|APPLE\\.COM/BILL|DISNEY|MACFIT|GITHUB|JETBRAINS|\\bAWS\\b',
    categoryId: 'subscriptions',
    direction: 'expense',
  },
  { type: 'regex', pattern: 'MIGROS|A101|\\bBIM\\b|\\bSOK\\b|CARREFOUR|FIRIN|MANAV|BÜFE|TEKEL', categoryId: 'groceries', direction: 'any' },
  {
    type: 'regex',
    pattern: 'YEMEKSEPETI|GETIR|STARBUCKS|KAHVE|SIMIT|LOKANTA|KEBAP|DÖNER|MEYHANE|RESTORAN|KÖFTE|BALIK|KAFE|CAFE',
    categoryId: 'dining',
    direction: 'any',
  },
  { type: 'regex', pattern: 'ISTANBULKART|BELBIM|SHELL|OPET|\\bBP\\b|PETROL|BITAKSI|ISPARK', categoryId: 'transport', direction: 'any' },
  { type: 'regex', pattern: 'PEGASUS|TURK HAVA|ETSTUR|BOOKING|OBILET|RENT A CAR|KIRALAMA|PLAJ', categoryId: 'travel', direction: 'any' },
  { type: 'regex', pattern: 'TRENDYOL|HEPSIBURADA|WAIKIKI|DEFACTO|KOTON|HACI BEKİR|KOSKA|GRATIS|WATSONS', categoryId: 'shopping', direction: 'any' },
  { type: 'regex', pattern: 'ECZANE|HASTANE', categoryId: 'health', direction: 'any' },
  { type: 'regex', pattern: 'CINEMAXIMUM|BILETIX|HALI SAHA', categoryId: 'entertainment', direction: 'any' },
  { type: 'contains', pattern: 'ATM', categoryId: 'cash', direction: 'expense' },
  { type: 'contains', pattern: 'SWIFT GELEN', categoryId: 'other-income', direction: 'income' },
  { type: 'amount', pattern: '', min: 40000, max: 250000, categoryId: 'salary', direction: 'income' },
]

export function createDefaultRules(createdAt: string): Rule[] {
  return DEFAULT_RULES.map((r, i) => ({
    ...r,
    id: `rule-default-${String(i + 1).padStart(2, '0')}`,
    priority: i,
    enabled: true,
    origin: 'default',
    createdAt,
  }))
}
