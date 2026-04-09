import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionNotFoundError } from "../../errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { toResponse } from "../../helpers/transaction.helpers"

export class GetTransactionQuery extends Query<Transaction> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler
  implements IQueryHandler<GetTransactionQuery>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(query: GetTransactionQuery): Promise<Transaction> {
    const row = await this.transactionRepo.findById(query.id, query.userId)
    if (!row) throw new TransactionNotFoundError()
    return toResponse(row)
  }
}
