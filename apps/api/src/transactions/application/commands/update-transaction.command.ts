import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  TransactionNotFoundError,
  TransferOperationError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event"
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event"

interface UpdateFields {
  accountId?: string
  amount?: number
  categoryId?: string | null
  note?: string | null
  date?: Date
  myShare?: number | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class UpdateTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly fields: UpdateFields
  ) {}
}

@CommandHandler(UpdateTransactionCommand)
export class UpdateTransactionHandler
  implements ICommandHandler<UpdateTransactionCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: UpdateTransactionCommand): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(
      command.id,
      command.userId
    )
    if (!transaction) throw new TransactionNotFoundError()
    if (transaction.isTransfer) throw new TransferOperationError()

    const { fields } = command

    // Allow setting accountId on orphaned transactions
    if (fields.accountId !== undefined && transaction.isOrphaned) {
      transaction.reassign(fields.accountId)
      // Adjust balance on target account
      this.eventBus.publish(
        new TransactionCreatedEvent(
          fields.accountId,
          transaction.isExpense ? "expense" : "income",
          transaction.amount
        )
      )
    }

    const oldAmount = transaction.amount
    if (fields.amount !== undefined) transaction.updateAmount(fields.amount)
    if (fields.categoryId !== undefined)
      transaction.updateCategory(fields.categoryId)
    if (fields.note !== undefined) transaction.updateNote(fields.note)
    if (fields.date !== undefined) transaction.updateDate(fields.date)

    if (fields.myShare === null) {
      transaction.clearMyShare()
    } else if (fields.myShare !== undefined) {
      transaction.updateMyShare(fields.myShare)
    }

    if (
      fields.originalAmount !== undefined &&
      fields.originalCurrency !== undefined &&
      fields.exchangeRate !== undefined
    ) {
      if (
        fields.originalAmount === null ||
        fields.originalCurrency === null ||
        fields.exchangeRate === null
      ) {
        transaction.clearExchangeRate()
      } else {
        transaction.updateExchangeRate(
          fields.originalAmount,
          fields.originalCurrency,
          fields.exchangeRate
        )
      }
    }

    const saved = await this.transactionRepo.save(transaction)

    if (
      fields.amount !== undefined &&
      fields.amount !== oldAmount &&
      saved.accountId
    ) {
      const direction = saved.isExpense ? "expense" : "income"
      this.eventBus.publish(
        new TransactionDeletedEvent(saved.accountId, direction, oldAmount)
      )
      this.eventBus.publish(
        new TransactionCreatedEvent(saved.accountId, direction, saved.amount)
      )
    }

    return saved
  }
}
