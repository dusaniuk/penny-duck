import { z } from "zod"

export const MonthlySummaryItemSchema = z.object({
  month: z.string(),
  income: z.number(),
  expenses: z.number(),
})

export const MonthlySummaryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
})

export type MonthlySummaryItem = z.infer<typeof MonthlySummaryItemSchema>

export const SpendingByCategoryItemSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  amount: z.number(),
})

export const SpendingByCategoryResponseSchema = z.object({
  month: z.string(),
  homeCurrency: z.string(),
  total: z.number(),
  categories: z.array(SpendingByCategoryItemSchema),
})

export type SpendingByCategoryItem = z.infer<typeof SpendingByCategoryItemSchema>
export type SpendingByCategoryResponse = z.infer<
  typeof SpendingByCategoryResponseSchema
>
