import { initContract } from "@ts-rest/core"
import { z } from "zod"

const c = initContract()

export const MonthlySummaryItemSchema = z.object({
  month: z.string(),
  income: z.number(),
  expenses: z.number(),
})

export const MonthlySummaryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
})

export type MonthlySummaryItem = z.infer<typeof MonthlySummaryItemSchema>

export const statsContract = c.router({
  monthlySummary: {
    method: "GET",
    path: "/stats/monthly-summary",
    query: MonthlySummaryQuerySchema,
    responses: {
      200: z.array(MonthlySummaryItemSchema),
    },
  },
})
