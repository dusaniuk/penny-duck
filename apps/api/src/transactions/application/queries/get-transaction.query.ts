import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"

export class GetTransactionQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler
  implements IQueryHandler<GetTransactionQuery>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(query: GetTransactionQuery): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(
      query.id,
      query.userId
    )
    if (!transaction) throw new TransactionNotFoundError()
    return transaction
  }
}
