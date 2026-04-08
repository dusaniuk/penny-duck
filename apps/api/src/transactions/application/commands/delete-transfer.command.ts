import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event"

export class DeleteTransferCommand {
  constructor(
    public readonly transferId: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(DeleteTransferCommand)
export class DeleteTransferHandler
  implements ICommandHandler<DeleteTransferCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: DeleteTransferCommand): Promise<void> {
    const pair = await this.transactionRepo.findByTransferId(
      command.transferId
    )
    if (pair.length !== 2) throw new TransactionNotFoundError()

    // Identify outgoing (expense) vs incoming (income) side
    const outgoing =
      pair.find((t) => t.exchangeRate !== null) ?? pair[0]
    const incoming = pair.find((t) => t !== outgoing)!

    await this.transactionRepo.deleteByTransferId(command.transferId)

    this.eventBus.publish(
      new TransactionDeletedEvent(outgoing.accountId!, "expense", outgoing.amount)
    )
    this.eventBus.publish(
      new TransactionDeletedEvent(incoming.accountId!, "income", incoming.amount)
    )
  }
}
