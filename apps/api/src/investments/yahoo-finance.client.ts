import { Injectable, Logger } from "@nestjs/common"
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

@Injectable()
export class YahooFinanceClient {
  private readonly logger = new Logger(YahooFinanceClient.name)

  async fetchQuotes(symbols: string[]): Promise<YahooQuote[]> {
    if (symbols.length === 0) return []
    try {
      const quotes = (await yahoo.quote(symbols, {
        fields: ["symbol", "longName", "shortName", "fullExchangeName", "currency", "regularMarketPrice"],
      })) as Array<Record<string, unknown>>
      const list = Array.isArray(quotes) ? quotes : [quotes]
      return list
        .filter((q) => q.regularMarketPrice != null)
        .map((q) => ({
          symbol: q.symbol as string,
          name: (q.longName ?? q.shortName ?? q.symbol) as string,
          exchange: ((q.fullExchangeName as string | undefined) ?? null) as string | null,
          currency: ((q.currency as string | undefined) ?? "USD") as string,
          price: q.regularMarketPrice as number,
        }))
    } catch (err: unknown) {
      if (this.isRateLimited(err)) throw new RateLimitedError()
      throw err
    }
  }

  async search(query: string): Promise<YahooSearchResult[]> {
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
      if (this.isRateLimited(err)) throw new RateLimitedError()
      throw err
    }
  }

  private isRateLimited(err: unknown): boolean {
    if (!err || typeof err !== "object") return false
    const response = (err as { response?: { status?: number } }).response
    return response?.status === 429
  }
}
