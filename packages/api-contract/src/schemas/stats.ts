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
