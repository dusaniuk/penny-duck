import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionRepository } from "../../repositories/transaction.repository"

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

export class ListTransactionsQuery {
  constructor(
    public readonly userId: string,
    public readonly filters: ListFilters
  ) {}
}

@QueryHandler(ListTransactionsQuery)
export class ListTransactionsHandler
  implements IQueryHandler<ListTransactionsQuery>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(
    query: ListTransactionsQuery
  ): Promise<{ data: Transaction[]; total: number }> {
    return this.transactionRepo.findAll({
      userId: query.userId,
      ...query.filters,
    })
  }
}
