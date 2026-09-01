import type { RawSection } from "./split-sections"
import type { ParsedEvent, RowError, TradeMetadata } from "./types"

interface Result {
  events: ParsedEvent[]
  errors: RowError[]
}

export function parseTradesSection(section: RawSection): Result {
  const events: ParsedEvent[] = []
  const errors: RowError[] = []

  section.rows.forEach((row, i) => {
    const line = section.rowLines[i]
    try {
      events.push(parseRow(row))
    } catch (err) {
      errors.push({
        line,
        reason: (err as Error).message,
        raw: Object.values(row).join(","),
      })
    }
  })

  return { events, errors }
}

function parseRow(row: Record<string, string>): ParsedEvent {
  const txType = row["TransactionType"]
  if (txType !== "ExchTrade") {
    throw new Error(`Unsupported TransactionType: ${txType || "(empty)"}`)
  }
  if (row["AssetClass"] !== "STK") {
    throw new Error(`Unsupported AssetClass: ${row["AssetClass"] || "(empty)"}`)
  }
  if (row["Multiplier"] !== "1") {
    throw new Error(`Unsupported Multiplier: ${row["Multiplier"]}`)
  }
  if (row["FXRateToBase"] !== "1") {
    throw new Error(
      `Multi-currency rows not supported yet (FXRateToBase=${row["FXRateToBase"]})`
    )
  }

  const buySell = row["Buy/Sell"]
  if (buySell !== "BUY" && buySell !== "SELL") {
    throw new Error(`Unsupported Buy/Sell: ${buySell}`)
  }

  const symbol = row["Symbol"]
  if (!symbol) throw new Error("Missing Symbol")

  const quantity = parseFloatOrThrow(row["Quantity"], "Quantity")
  const price = parseFloatOrThrow(row["TradePrice"], "TradePrice")
  const commission = parseFloatOrDefault(row["IBCommission"], 0)
  const fees = Math.abs(commission)

  const date = parseIbkrDateTime(row["DateTime"], row["TradeDate"])
  const externalId = row["TradeID"]
  if (!externalId) throw new Error("Missing TradeID — cannot dedup")

  const notes = (row["Notes/Codes"] || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const openClose =
    row["Open/CloseIndicator"] === "O" || row["Open/CloseIndicator"] === "C"
      ? (row["Open/CloseIndicator"] as "O" | "C")
      : null

  const metadata: TradeMetadata = {
    section: "trades",
    execId: row["IBExecID"] || null,
    exchange: row["Exchange"] || null,
    listingExchange: row["ListingExchange"] || null,
    orderType: row["OrderType"] || null,
    notes,
    openClose,
    settleDate: formatIbkrDate(row["SettleDateTarget"]),
    intradayTimestamp: formatIbkrDateTime(row["DateTime"]),
    clientAccountId: row["ClientAccountID"] || null,
    taxes: parseFloatOrDefault(row["Taxes"], 0),
    tradeMoney: parseFloatOrDefault(row["TradeMoney"], 0),
    netCash: parseFloatOrDefault(row["NetCash"], 0),
    ibCommissionCurrency: row["IBCommissionCurrency"] || null,
  }

  return {
    kind: buySell === "BUY" ? "buy" : "sell",
    symbol,
    quantity,
    price,
    fees,
    date,
    currency: row["CurrencyPrimary"] || "USD",
    externalSource: "ibkr_flex_query",
    externalId,
    externalMetadata: metadata,
  }
}

function parseFloatOrThrow(raw: string, field: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Invalid ${field}: "${raw}"`)
  return n
}

function parseFloatOrDefault(
  raw: string | undefined,
  fallback: number
): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * IBKR `DateTime` format: "YYYYMMDD;HHMMSS". `TradeDate` fallback: "YYYYMMDD".
 * Stored as UTC (IBKR doesn't emit a timezone; treating as UTC for internal ordering).
 */
function parseIbkrDateTime(
  dateTime: string | undefined,
  tradeDate: string | undefined
): Date {
  if (dateTime && dateTime.includes(";")) {
    const [d, t] = dateTime.split(";")
    if (d.length === 8 && t.length === 6) {
      const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`
      const date = new Date(iso)
      if (!isNaN(date.getTime())) return date
    }
  }
  if (tradeDate && tradeDate.length === 8) {
    const iso = `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}T00:00:00Z`
    const date = new Date(iso)
    if (!isNaN(date.getTime())) return date
  }
  throw new Error(
    `Invalid date: DateTime="${dateTime}" TradeDate="${tradeDate}"`
  )
}

function formatIbkrDate(raw: string | undefined): string | null {
  if (!raw || raw.length !== 8) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function formatIbkrDateTime(raw: string | undefined): string | null {
  if (!raw || !raw.includes(";")) return null
  const [d, t] = raw.split(";")
  if (d.length !== 8 || t.length !== 6) return null
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
}
