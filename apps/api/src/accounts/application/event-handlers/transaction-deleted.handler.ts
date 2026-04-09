import { EventsHandler, IEventHandler } from "@nestjs/cqrs"
import { TransactionDeletedEvent } from "../../../transactions/events/transaction-deleted.event"
import { AccountRepository } from "../../repositories/account.repository"

@EventsHandler(TransactionDeletedEvent)
export class TransactionDeletedHandler
  implements IEventHandler<TransactionDeletedEvent>
{
  constructor(private readonly accountRepo: AccountRepository) {}

  async handle(event: TransactionDeletedEvent): Promise<void> {
    const account = await this.accountRepo.findByAccountId(event.accountId)
    if (!account) return

    const adjustment =
      event.direction === "expense" ? event.amount : -event.amount
    await this.accountRepo.update(account.id, {
      balance: account.balance + adjustment,
    })
  }
}
