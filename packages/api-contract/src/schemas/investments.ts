import { z } from "zod"

// ----- Instruments -----

export const InstrumentSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  exchange: z.string().nullable(),
  currency: z.string(),
  lastPrice: z.number(),
  lastPricedAt: z.string().nullable(),
})

export type Instrument = z.infer<typeof InstrumentSchema>

export const InstrumentSearchQuerySchema = z.object({
  q: z.string().min(1),
})

// ----- Positions -----

export const PositionSchema = z.object({
  accountId: z.uuid(),
  symbol: z.string(),
  name: z.string(),
  currency: z.string(),
  quantity: z.number(),
  averageCost: z.number(),
  currentPrice: z.number(),
  currentValue: z.number(),
  unrealizedGain: z.number(),
  unrealizedGainPct: z.number(),
  realizedGain: z.number(),
  homeCurrentValue: z.number(),
  homeUnrealizedGain: z.number(),
})

export type Position = z.infer<typeof PositionSchema>

export const PositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
  pricesStale: z.boolean(),
})

// ----- Summary -----

export const InvestmentsSummarySchema = z.object({
  totalValueHome: z.number(),
  totalCostHome: z.number(),
  totalUnrealizedGainHome: z.number(),
  totalRealizedGainHome: z.number(),
  positionsCount: z.number(),
  pricesStale: z.boolean(),
})

export type InvestmentsSummary = z.infer<typeof InvestmentsSummarySchema>

// ----- Trades -----

export const TradeTypeSchema = z.enum(["buy", "sell", "dividend"])

export const TradeSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  instrumentId: z.uuid(),
  symbol: z.string(),
  type: TradeTypeSchema,
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number(),
  fees: z.number(),
  withheldTax: z.number().nullable(),
  date: z.string(),
  externalSource: z.string().nullable(),
  externalId: z.string().nullable(),
  externalMetadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export type Trade = z.infer<typeof TradeSchema>

export const CreateTradeSchema = z.object({
  accountId: z.uuid(),
  symbol: z.string().min(1).max(20),
  type: TradeTypeSchema,
  quantity: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
  amount: z.number().positive().optional(),
  fees: z.number().nonnegative().optional(),
  date: z.string(),
})

export const UpdateTradeSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  quantity: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
  amount: z.number().positive().optional(),
  fees: z.number().nonnegative().optional(),
  date: z.string().optional(),
})

export const ListTradesQuerySchema = z.object({
  accountId: z.uuid().optional(),
  symbol: z.string().optional(),
  type: TradeTypeSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

// ----- IBKR Import -----

export const ImportTradesRowSchema = z.object({
  kind: z.enum(["buy", "sell", "dividend"]),
  symbol: z.string(),
  date: z.string(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number(),
  withheldTax: z.number().nullable(),
  fees: z.number(),
  externalId: z.string(),
  status: z.enum(["new", "duplicate", "error"]),
  errorMessage: z.string().nullable(),
})

export const ImportTradesSummarySchema = z.object({
  clientAccountId: z.string().nullable(),
  tradesFound: z.number(),
  tradesToCreate: z.number(),
  tradesSkippedAsDuplicate: z.number(),
  dividendsFound: z.number(),
  dividendsToCreate: z.number(),
  dividendsSkippedAsDuplicate: z.number(),
  depositsFound: z.number(),
  depositsTotalAmount: z.number(),
  rowErrors: z.number(),
})

export const ImportTradesParseErrorSchema = z.object({
  line: z.number(),
  reason: z.string(),
})

export const ImportTradesResponseSchema = z.object({
  summary: ImportTradesSummarySchema,
  rows: z.array(ImportTradesRowSchema),
  parseErrors: z.array(ImportTradesParseErrorSchema),
  committed: z.boolean(),
  createdCount: z.number(),
})

export type ImportTradesResponse = z.infer<typeof ImportTradesResponseSchema>
export type ImportTradesSummary = z.infer<typeof ImportTradesSummarySchema>
export type ImportTradesRow = z.infer<typeof ImportTradesRowSchema>
export type ImportTradesParseError = z.infer<typeof ImportTradesParseErrorSchema>
