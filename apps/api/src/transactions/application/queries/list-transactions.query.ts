import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { toResponse } from "../../helpers/transaction.helpers"

interface ListFilters {
  page: number
  limit: number
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  orphaned?: boolean
  dateFrom?: Date
  dateTo?: Date
}

export class ListTransactionsQuery extends Query<{
  data: Transaction[]
  total: number
}> {
  constructor(
    public readonly userId: string,
    public readonly filters: ListFilters
  ) {
    super()
  }
}

@QueryHandler(ListTransactionsQuery)
export class ListTransactionsHandler
  implements IQueryHandler<ListTransactionsQuery>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(
    query: ListTransactionsQuery
  ): Promise<{ data: Transaction[]; total: number }> {
    const { data, total } = await this.transactionRepo.findAll({
      userId: query.userId,
      ...query.filters,
    })
    return { data: data.map(toResponse), total }
  }
}
