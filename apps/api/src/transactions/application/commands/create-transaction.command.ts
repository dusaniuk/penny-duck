import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event"

export interface CreateTransactionInput {
  userId: string
  accountId: string
  type: string
  amount: number
  categoryId: string | null
  date: Date
  note?: string | null
  myShare?: number | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class CreateTransactionCommand {
  constructor(public readonly input: CreateTransactionInput) {}
}

@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler
  implements ICommandHandler<CreateTransactionCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: CreateTransactionCommand): Promise<Transaction> {
    const transaction = Transaction.create(command.input)

    const saved = await this.transactionRepo.save(transaction)

    this.eventBus.publish(
      new TransactionCreatedEvent(
        saved.accountId!,
        saved.isExpense ? "expense" : "income",
        saved.amount
      )
    )

    return saved
  }
}
