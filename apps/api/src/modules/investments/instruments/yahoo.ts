import YahooFinance from "yahoo-finance2"

const yahoo = new YahooFinance()

export class RateLimitedError extends Error {
  constructor() {
    super("Yahoo Finance rate limited")
    this.name = "RateLimitedError"
  }
}

export interface YahooQuote {
  symbol: string
  name: string
  exchange: string | null
  currency: string
  price: number
}

export interface YahooSearchResult {
  symbol: string
  name: string
  exchange: string | null
}

function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const response = (err as { response?: { status?: number } }).response
  return response?.status === 429
}

export async function fetchQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return []
  try {
    const quotes = (await yahoo.quote(symbols, {
      fields: [
        "symbol",
        "longName",
        "shortName",
        "fullExchangeName",
        "currency",
        "regularMarketPrice",
      ],
    })) as Array<Record<string, unknown>>
    const list = Array.isArray(quotes) ? quotes : [quotes]
    return list
      .filter((q) => q.regularMarketPrice != null)
      .map((q) => ({
        symbol: q.symbol as string,
        name: (q.longName ?? q.shortName ?? q.symbol) as string,
        exchange: ((q.fullExchangeName as string | undefined) ?? null) as
          | string
          | null,
        currency: ((q.currency as string | undefined) ?? "USD") as string,
        price: q.regularMarketPrice as number,
      }))
  } catch (err: unknown) {
    if (isRateLimited(err)) throw new RateLimitedError()
    throw err
  }
}

export async function searchYahoo(query: string): Promise<YahooSearchResult[]> {
  try {
    const res = (await yahoo.search(query, { quotesCount: 10 })) as {
      quotes?: Array<Record<string, unknown>>
    }
    const quotes = (res.quotes ?? []) as Array<Record<string, unknown>>
    return quotes
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .map((q) => ({
        symbol: (q.symbol ?? "") as string,
        name: (q.shortname ?? q.longname ?? q.symbol ?? "") as string,
        exchange: ((q.exchange as string | undefined) ?? null) as string | null,
      }))
      .filter((q) => q.symbol.length > 0)
  } catch (err: unknown) {
    if (isRateLimited(err)) throw new RateLimitedError()
    throw err
  }
}

export interface YahooHistoricalPoint {
  date: string // YYYY-MM-DD
  close: number
}

export async function fetchHistorical(
  symbol: string,
  from: Date,
  to: Date,
): Promise<YahooHistoricalPoint[]> {
  try {
    const result = (await yahoo.chart(symbol, {
      period1: from,
      period2: to,
      interval: "1d",
    })) as { quotes?: Array<{ date: Date; close: number | null }> }
    const quotes = result.quotes ?? []
    return quotes
      .filter((q): q is { date: Date; close: number } => q.close != null)
      .map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        close: q.close,
      }))
  } catch (err: unknown) {
    if (isRateLimited(err)) throw new RateLimitedError()
    throw err
  }
}
