import { NotFoundException } from "@nestjs/common"
import { Query, QueryHandler, IQueryHandler } from "@nestjs/cqrs"
import { type Position } from "@workspace/api-contract"
import { TradeRepository } from "../trade.repository"
import { InstrumentRepository } from "../instrument.repository"
import { InstrumentService } from "../instrument.service"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"
import { toPositionResponse } from "../helpers/investments.helpers"
import { replayPosition } from "../helpers/replay-position"

export class GetPositionBySymbolQuery extends Query<Position> {
  constructor(
    public readonly accountId: string,
    public readonly symbol: string,
    public readonly organizationId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@QueryHandler(GetPositionBySymbolQuery)
export class GetPositionBySymbolHandler
  implements IQueryHandler<GetPositionBySymbolQuery>
{
  constructor(
    private readonly tradeRepo: TradeRepository,
    private readonly instrumentRepo: InstrumentRepository,
    private readonly instrumentService: InstrumentService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository
  ) {}

  async execute(q: GetPositionBySymbolQuery): Promise<Position> {
    const inst = await this.instrumentRepo.findBySymbol(q.symbol.toUpperCase())
    if (!inst) throw new NotFoundException("Instrument not found")

    const tradeRows = await this.tradeRepo.findAllForReplay(q.accountId, inst.id)
    if (tradeRows.length === 0) throw new NotFoundException("Position not found")

    const state = replayPosition(
      tradeRows.map((t) => ({
        type: t.type as "buy" | "sell" | "dividend",
        quantity: t.quantity,
        price: t.price,
        fees: t.fees,
        date: t.date,
        createdAt: t.createdAt,
      }))
    )

    const { refreshed } = await this.instrumentService.refreshIfStale([inst])
    const refreshedInst = refreshed[0] ?? inst

    const user = await this.userRepo.findById(q.userId)
    const homeCurrency = user?.homeCurrency ?? "UAH"
    const rate = await this.exchangeRateService.getRate(
      refreshedInst.currency,
      homeCurrency,
      new Date(),
      [refreshedInst.currency, homeCurrency]
    )

    return toPositionResponse(state, refreshedInst, q.accountId, rate)
  }
}
