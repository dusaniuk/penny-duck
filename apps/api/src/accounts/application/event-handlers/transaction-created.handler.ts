import { EventsHandler, IEventHandler } from "@nestjs/cqrs"
import { TransactionCreatedEvent } from "../../../transactions/domain/events/transaction-created.event"
import { AccountRepository } from "../../domain/repositories/account.repository"

@EventsHandler(TransactionCreatedEvent)
export class TransactionCreatedHandler
  implements IEventHandler<TransactionCreatedEvent>
{
  constructor(private readonly accountRepo: AccountRepository) {}

  async handle(event: TransactionCreatedEvent): Promise<void> {
    const account = await this.accountRepo.findByAccountId(event.accountId)
    if (!account) return

    const adjustment =
      event.direction === "expense" ? -event.amount : event.amount
    account.adjustBalance(adjustment)
    await this.accountRepo.save(account)
  }
}
