import { initContract } from "@ts-rest/core"
import { z } from "zod"

const c = initContract()

export const ExchangeRatesResponseSchema = z.object({
  date: z.string(),
  rates: z.record(z.string(), z.record(z.string(), z.number())),
})

export const exchangeRateContract = c.router({
  latest: {
    method: "GET",
    path: "/exchange-rates/latest",
    responses: {
      200: ExchangeRatesResponseSchema,
    },
  },
})
