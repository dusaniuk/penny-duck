import { z } from "zod"

export const ExchangeRatesResponseSchema = z.object({
  date: z.string(),
  rates: z.record(z.string(), z.record(z.string(), z.number())),
})
