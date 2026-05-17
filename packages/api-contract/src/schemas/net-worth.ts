import { z } from "zod"

export const NetWorthTopAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  homeBalance: z.number(),
})

export const NetWorthChangeSchema = z.object({
  absolute: z.number(),
  percent: z.number(),
})

export const NetWorthCurrentSchema = z.object({
  total: z.number(),
  cash: z.number(),
  investments: z.number(),
  homeCurrency: z.string(),
  pricesStale: z.boolean(),
  accountsCount: z.number(),
  topAccounts: z.array(NetWorthTopAccountSchema),
})

export const NetWorthHistoryPointSchema = z.object({
  date: z.string(),
  total: z.number(),
})

export const NetWorthHistorySchema = z.object({
  points: z.array(NetWorthHistoryPointSchema),
  change: NetWorthChangeSchema.nullable(),
})

export const NetWorthResponseSchema = z.object({
  current: NetWorthCurrentSchema,
  history: NetWorthHistorySchema,
})

export type NetWorthCurrent = z.infer<typeof NetWorthCurrentSchema>
export type NetWorthHistory = z.infer<typeof NetWorthHistorySchema>
export type NetWorthResponse = z.infer<typeof NetWorthResponseSchema>
