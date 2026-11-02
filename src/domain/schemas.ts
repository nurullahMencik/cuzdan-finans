import { z } from 'zod'
import { CATEGORY_IDS } from './types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Boundary validation for data coming from files or forms before it reaches IndexedDB. */
export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  date: isoDate,
  description: z.string().min(1).max(500),
  merchant: z.string().min(1),
  merchantKey: z.string(),
  amount: z.number().finite(),
  currency: z.enum(['TRY', 'USD', 'EUR']),
  categoryId: z.enum(CATEGORY_IDS),
  categorySource: z.enum(['rule', 'manual', 'default']),
  ruleId: z.string().optional(),
  hash: z.string().min(1),
  importId: z.string().optional(),
})

export const accountFormSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['checking', 'credit', 'fx']),
  currency: z.enum(['TRY', 'USD', 'EUR']),
  openingBalance: z.number().finite(),
})

export const fxRateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  USD: z.number().positive().finite(),
  EUR: z.number().positive().finite(),
})
