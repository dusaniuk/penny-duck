import { Query, QueryHandler, IQueryHandler } from "@nestjs/cqrs"
import { type Instrument } from "@workspace/api-contract"
import { InstrumentService } from "../instrument.service"

export class GetInstrumentQuery extends Query<Instrument> {
  constructor(public readonly symbol: string) {
    super()
  }
}

@QueryHandler(GetInstrumentQuery)
export class GetInstrumentHandler implements IQueryHandler<GetInstrumentQuery> {
  constructor(private readonly service: InstrumentService) {}

  async execute(query: GetInstrumentQuery): Promise<Instrument> {
    const inst = await this.service.ensureBySymbol(query.symbol)
    const { refreshed } = await this.service.refreshIfStale([inst])
    const row = refreshed[0] ?? inst
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
      currency: row.currency,
      lastPrice: row.lastPrice,
      lastPricedAt: row.lastPricedAt?.toISOString() ?? null,
    }
  }
}
