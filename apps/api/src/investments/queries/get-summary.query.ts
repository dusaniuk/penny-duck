import { Query, QueryHandler, IQueryHandler, QueryBus } from "@nestjs/cqrs"
import { type InvestmentsSummary } from "@workspace/api-contract"
import { GetPositionsQuery } from "./get-positions.query"

export class GetInvestmentsSummaryQuery extends Query<InvestmentsSummary> {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@QueryHandler(GetInvestmentsSummaryQuery)
export class GetInvestmentsSummaryHandler
  implements IQueryHandler<GetInvestmentsSummaryQuery>
{
  constructor(private readonly queryBus: QueryBus) {}

  async execute(q: GetInvestmentsSummaryQuery): Promise<InvestmentsSummary> {
    const { positions, pricesStale } = await this.queryBus.execute(
      new GetPositionsQuery(q.organizationId, q.userId)
    )

    let totalValueHome = 0
    let totalCostHome = 0
    let totalUnrealizedGainHome = 0
    let totalRealizedGainHome = 0

    for (const p of positions) {
      // Derive the instrument → home FX rate implicit in the position response.
      const rate = p.currentValue > 0 ? p.homeCurrentValue / p.currentValue : 1
      totalValueHome += p.homeCurrentValue
      totalCostHome += p.quantity * p.averageCost * rate
      totalUnrealizedGainHome += p.homeUnrealizedGain
      totalRealizedGainHome += p.realizedGain * rate
    }

    return {
      totalValueHome,
      totalCostHome,
      totalUnrealizedGainHome,
      totalRealizedGainHome,
      positionsCount: positions.filter((p) => p.quantity > 0).length,
      pricesStale,
    }
  }
}
