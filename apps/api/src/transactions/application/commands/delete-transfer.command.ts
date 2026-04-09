import {
  Command,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from "@nestjs/cqrs"
import { TransactionNotFoundError } from "../../errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { TransactionDeletedEvent } from "../../events/transaction-deleted.event"

export class DeleteTransferCommand extends Command<void> {
  constructor(
    public readonly transferId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteTransferCommand)
export class DeleteTransferHandler
  implements ICommandHandler<DeleteTransferCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(cmd: DeleteTransferCommand): Promise<void> {
    const pair = await this.transactionRepo.findByTransferId(cmd.transferId)
    if (pair.length !== 2) throw new TransactionNotFoundError()

    const outgoing =
      pair.find((t) => t.originalAmount !== null) ?? pair[0]
    const incoming = pair.find((t) => t !== outgoing)!

    await this.transactionRepo.deleteByTransferId(cmd.transferId)

    this.eventBus.publish(
      new TransactionDeletedEvent(
        outgoing.accountId!,
        "expense",
        outgoing.amount
      )
    )
    this.eventBus.publish(
      new TransactionDeletedEvent(
        incoming.accountId!,
        "income",
        incoming.amount
      )
    )
  }
}
