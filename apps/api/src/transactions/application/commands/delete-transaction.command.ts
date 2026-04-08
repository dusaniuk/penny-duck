import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import {
  TransactionNotFoundError,
  TransferOperationError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event"

export class DeleteTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(DeleteTransactionCommand)
export class DeleteTransactionHandler
  implements ICommandHandler<DeleteTransactionCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: DeleteTransactionCommand): Promise<void> {
    const transaction = await this.transactionRepo.findById(
      command.id,
      command.userId
    )
    if (!transaction) throw new TransactionNotFoundError()
    if (transaction.isTransfer) throw new TransferOperationError()

    await this.transactionRepo.delete(command.id, command.userId)

    this.eventBus.publish(
      new TransactionDeletedEvent(
        transaction.accountId!,
        transaction.isExpense ? "expense" : "income",
        transaction.amount
      )
    )
  }
}
