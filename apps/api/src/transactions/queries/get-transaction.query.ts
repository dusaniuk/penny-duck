import { NotFoundException } from "@nestjs/common"
import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import { toResponse } from "../helpers/transaction.helpers"

export class GetTransactionQuery extends Query<Transaction> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<GetTransactionQuery> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(query: GetTransactionQuery): Promise<Transaction> {
    const row = await this.transactionRepo.findById(query.id, query.userId)
    if (!row) throw new NotFoundException("Transaction not found")
    return toResponse(row)
  }
}
