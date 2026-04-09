import {
  Command,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { TransactionDeletedEvent } from "../../events/transaction-deleted.event"

export class DeleteTransactionCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteTransactionCommand)
export class DeleteTransactionHandler
  implements ICommandHandler<DeleteTransactionCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(cmd: DeleteTransactionCommand): Promise<void> {
    const row = await this.transactionRepo.findById(cmd.id, cmd.userId)
    if (!row) throw new NotFoundException("Transaction not found")
    if (row.type === "transfer")
      throw new BadRequestException(
        "Use the transfer endpoint to modify transfer transactions"
      )

    await this.transactionRepo.delete(cmd.id, cmd.userId)

    this.eventBus.publish(
      new TransactionDeletedEvent(
        row.accountId!,
        row.type === "expense" ? "expense" : "income",
        row.amount
      )
    )
  }
}
