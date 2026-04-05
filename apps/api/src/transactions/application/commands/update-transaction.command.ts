import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  TransactionNotFoundError,
  TransferOperationError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"

interface UpdateFields {
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
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(command: UpdateTransactionCommand): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(
      command.id,
      command.userId
    )
    if (!transaction) throw new TransactionNotFoundError()
    if (transaction.isTransfer) throw new TransferOperationError()

    const { fields } = command

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

    return this.transactionRepo.save(transaction)
  }
}
