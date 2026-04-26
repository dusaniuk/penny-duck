import { Query, QueryHandler, IQueryHandler } from "@nestjs/cqrs"
import { type Position } from "@workspace/api-contract"
import { TradeRepository } from "../trade.repository"
import { InstrumentRepository } from "../instrument.repository"
import { InstrumentService } from "../instrument.service"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"
import { toPositionResponse } from "../helpers/investments.helpers"
import { replayPosition, type ReplayTrade } from "../helpers/replay-position"

export class GetPositionsQuery extends Query<{
  positions: Position[]
  pricesStale: boolean
}> {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@QueryHandler(GetPositionsQuery)
export class GetPositionsHandler implements IQueryHandler<GetPositionsQuery> {
  constructor(
    private readonly tradeRepo: TradeRepository,
    private readonly instrumentRepo: InstrumentRepository,
    private readonly instrumentService: InstrumentService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository
  ) {}

  async execute(
    q: GetPositionsQuery
  ): Promise<{ positions: Position[]; pricesStale: boolean }> {
    const [allTrades, user] = await Promise.all([
      this.tradeRepo.findAllByOrg(q.organizationId),
      this.userRepo.findById(q.userId),
    ])
    if (allTrades.length === 0) return { positions: [], pricesStale: false }

    const groups = new Map<
      string,
      { accountId: string; instrumentId: string; trades: ReplayTrade[] }
    >()
    for (const t of allTrades) {
      const key = `${t.accountId}:${t.instrumentId}`
      const existing = groups.get(key)
      const replayTrade: ReplayTrade = {
        type: t.type as "buy" | "sell" | "dividend",
        quantity: t.quantity,
        price: t.price,
        fees: t.fees,
        date: t.date,
        createdAt: t.createdAt,
      }
      if (existing) existing.trades.push(replayTrade)
      else
        groups.set(key, {
          accountId: t.accountId,
          instrumentId: t.instrumentId,
          trades: [replayTrade],
        })
    }

    const instrumentIds = [...new Set(allTrades.map((t) => t.instrumentId))]
    const instrumentRows = await this.instrumentRepo.findByIds(instrumentIds)
    const { refreshed, stale } =
      await this.instrumentService.refreshIfStale(instrumentRows)
    const byId = new Map(refreshed.map((r) => [r.id, r]))

    const homeCurrency = user?.homeCurrency ?? "UAH"
    const today = new Date()
    const currencies = [...new Set(refreshed.map((r) => r.currency))]
    const rates = new Map<string, number>()
    for (const cur of currencies) {
      rates.set(
        cur,
        await this.exchangeRateService.getRate(cur, homeCurrency, today, [
          cur,
          homeCurrency,
        ])
      )
    }

    const positions: Position[] = []
    for (const group of groups.values()) {
      const state = replayPosition(group.trades)
      if (state.quantity === 0 && state.realizedGain === 0) continue
      const inst = byId.get(group.instrumentId)
      if (!inst) continue
      positions.push(
        toPositionResponse(state, inst, group.accountId, rates.get(inst.currency) ?? 1)
      )
    }

    return { positions, pricesStale: stale }
  }
}
