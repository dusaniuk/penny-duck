import { Query, QueryHandler, IQueryHandler } from "@nestjs/cqrs"
import { type Trade } from "@workspace/api-contract"
import { TradeRepository } from "../trade.repository"
import { toTradeResponse } from "../helpers/investments.helpers"

export interface GetTradesInput {
  organizationId: string
  accountId?: string
  symbol?: string
  type?: string
  from?: Date
  to?: Date
}

export class GetTradesQuery extends Query<Trade[]> {
  constructor(public readonly input: GetTradesInput) {
    super()
  }
}

@QueryHandler(GetTradesQuery)
export class GetTradesHandler implements IQueryHandler<GetTradesQuery> {
  constructor(private readonly repo: TradeRepository) {}

  async execute(query: GetTradesQuery): Promise<Trade[]> {
    const rows = await this.repo.findAll(query.input)
    return rows.map((r) => toTradeResponse(r))
  }
}
