import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  InvalidSettlementError,
  TransactionNotFoundError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"

export class SettleTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(SettleTransactionCommand)
export class SettleTransactionHandler
  implements ICommandHandler<SettleTransactionCommand>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(command: SettleTransactionCommand): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(
      command.id,
      command.userId
    )
    if (!transaction) throw new TransactionNotFoundError()
    if (!transaction.isShared) throw new InvalidSettlementError()

    transaction.markAsSettled()
    return this.transactionRepo.save(transaction)
  }
}
