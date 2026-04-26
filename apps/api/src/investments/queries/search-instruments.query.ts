import { Query, QueryHandler, IQueryHandler } from "@nestjs/cqrs"
import { type Instrument } from "@workspace/api-contract"
import { InstrumentRepository } from "../instrument.repository"
import { YahooFinanceClient } from "../yahoo-finance.client"

export class SearchInstrumentsQuery extends Query<Instrument[]> {
  constructor(public readonly q: string) {
    super()
  }
}

@QueryHandler(SearchInstrumentsQuery)
export class SearchInstrumentsHandler implements IQueryHandler<SearchInstrumentsQuery> {
  constructor(
    private readonly repo: InstrumentRepository,
    private readonly yahoo: YahooFinanceClient
  ) {}

  async execute(query: SearchInstrumentsQuery): Promise<Instrument[]> {
    const local = await this.repo.searchLocal(query.q)
    if (local.length >= 5) {
      return local.map(toInstrument)
    }

    const remote = await this.yahoo.search(query.q).catch(() => [])
    const haveSymbols = new Set(local.map((r) => r.symbol.toUpperCase()))
    const merged: Instrument[] = local.map(toInstrument)
    for (const r of remote) {
      if (haveSymbols.has(r.symbol.toUpperCase())) continue
      merged.push({
        id: "",
        symbol: r.symbol.toUpperCase(),
        name: r.name,
        exchange: r.exchange,
        currency: "USD",
        lastPrice: 0,
        lastPricedAt: null,
      })
    }
    return merged.slice(0, 10)
  }
}

function toInstrument(r: {
  id: string
  symbol: string
  name: string
  exchange: string | null
  currency: string
  lastPrice: number
  lastPricedAt: Date | null
}): Instrument {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    exchange: r.exchange,
    currency: r.currency,
    lastPrice: r.lastPrice,
    lastPricedAt: r.lastPricedAt?.toISOString() ?? null,
  }
}
