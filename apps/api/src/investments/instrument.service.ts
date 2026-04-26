import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { InstrumentRepository, type InstrumentRow } from "./instrument.repository"
import { YahooFinanceClient, RateLimitedError } from "./yahoo-finance.client"

const STALENESS_MS = 15 * 60 * 1000

@Injectable()
export class InstrumentService {
  private readonly logger = new Logger(InstrumentService.name)

  constructor(
    private readonly repo: InstrumentRepository,
    private readonly yahoo: YahooFinanceClient
  ) {}

  /** Look up by symbol, fetching from Yahoo if missing. Throws NotFound if Yahoo returns nothing. */
  async ensureBySymbol(symbol: string): Promise<InstrumentRow> {
    const upper = symbol.toUpperCase()
    const cached = await this.repo.findBySymbol(upper)
    if (cached) return cached

    const quotes = await this.yahoo.fetchQuotes([upper])
    if (quotes.length === 0) throw new NotFoundException(`Symbol ${upper} not found`)
    const q = quotes[0]
    return this.repo.upsert({
      symbol: q.symbol,
      name: q.name,
      exchange: q.exchange,
      currency: q.currency,
      lastPrice: q.price,
      lastPricedAt: new Date(),
    })
  }

  /**
   * Refreshes prices for any instruments whose `lastPricedAt` is older than the staleness threshold.
   * Returns the updated rows (falling back to cached values if Yahoo didn't respond for that symbol)
   * and a boolean indicating whether any price ended up still stale.
   * Never throws on Yahoo failure — logs and serves stale.
   */
  async refreshIfStale(
    rows: InstrumentRow[]
  ): Promise<{ refreshed: InstrumentRow[]; stale: boolean }> {
    const now = Date.now()
    const staleRows = rows.filter(
      (r) => !r.lastPricedAt || now - r.lastPricedAt.getTime() > STALENESS_MS
    )
    if (staleRows.length === 0) return { refreshed: rows, stale: false }

    try {
      const quotes = await this.yahoo.fetchQuotes(staleRows.map((r) => r.symbol))
      const priceBySymbol = new Map(quotes.map((q) => [q.symbol, q.price]))
      const refreshedAt = new Date()
      const updated: InstrumentRow[] = []
      for (const row of rows) {
        const newPrice = priceBySymbol.get(row.symbol)
        if (newPrice == null) {
          updated.push(row)
          continue
        }
        await this.repo.updatePrice(row.id, newPrice, refreshedAt)
        updated.push({ ...row, lastPrice: newPrice, lastPricedAt: refreshedAt })
      }
      const stillStale = updated.some(
        (r) => !r.lastPricedAt || now - r.lastPricedAt.getTime() > STALENESS_MS
      )
      return { refreshed: updated, stale: stillStale }
    } catch (err) {
      if (err instanceof RateLimitedError) {
        this.logger.warn("Yahoo rate-limited; serving stale prices")
      } else {
        this.logger.warn(`Yahoo fetch failed: ${(err as Error).message}; serving stale prices`)
      }
      return { refreshed: rows, stale: true }
    }
  }
}
