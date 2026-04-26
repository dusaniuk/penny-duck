// apps/api/src/investments/import/types.ts

export interface TradeMetadata {
  section: "trades"
  execId: string | null
  exchange: string | null
  listingExchange: string | null
  orderType: string | null
  notes: string[]
  openClose: "O" | "C" | null
  settleDate: string | null
  intradayTimestamp: string | null
  clientAccountId: string | null
  taxes: number
  tradeMoney: number
  netCash: number
  ibCommissionCurrency: string | null
}

export interface DividendMetadata {
  section: "cash_transactions"
  dividendType: string | null
  paymentDate: string | null
  settleDate: string | null
  exDate: string | null
  description: string
  clientAccountId: string | null
  withholdingRows: number
  actionId: string | null
}

export interface DepositMetadata {
  section: "cash_transactions"
  type: "Deposits/Withdrawals"
  description: string
  settleDate: string | null
  clientAccountId: string | null
}

export type ParsedEvent =
  | {
      kind: "buy" | "sell"
      symbol: string
      quantity: number
      price: number
      fees: number
      date: Date
      currency: string
      externalSource: "ibkr_flex_query"
      externalId: string
      externalMetadata: TradeMetadata
    }
  | {
      kind: "dividend"
      symbol: string
      amount: number
      withheldTax: number
      date: Date
      currency: string
      externalSource: "ibkr_flex_query"
      externalId: string
      externalMetadata: DividendMetadata
    }

export interface ParsedDeposit {
  amount: number
  date: Date
  currency: string
  externalSource: "ibkr_flex_query"
  externalId: string
  externalMetadata: DepositMetadata
}

export interface SkippedRow {
  reason: "unsupported_type"
  type: string
  amount: number
  line: number
}

export interface RowError {
  line: number
  reason: string
  raw: string
}

export interface ParsedImport {
  clientAccountId: string | null
  events: ParsedEvent[]
  deposits: ParsedDeposit[]
  skipped: SkippedRow[]
  errors: RowError[]
}
