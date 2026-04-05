import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"

interface UpdateTransferFields {
  amount?: number
  date?: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class UpdateTransferCommand {
  constructor(
    public readonly transferId: string,
    public readonly userId: string,
    public readonly fields: UpdateTransferFields
  ) {}
}

@CommandHandler(UpdateTransferCommand)
export class UpdateTransferHandler
  implements ICommandHandler<UpdateTransferCommand>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(
    command: UpdateTransferCommand
  ): Promise<[Transaction, Transaction]> {
    const pair = await this.transactionRepo.findByTransferId(
      command.transferId
    )
    if (pair.length !== 2) throw new TransactionNotFoundError()

    // The side with exchange rate info is the outgoing side.
    // For same-currency transfers, either order works — pick first as outgoing.
    const outgoing =
      pair.find((t) => t.exchangeRate !== null) ?? pair[0]
    const incoming = pair.find((t) => t !== outgoing)!

    const { fields } = command

    if (fields.note !== undefined) {
      outgoing.updateNote(fields.note)
      incoming.updateNote(fields.note)
    }
    if (fields.date !== undefined) {
      outgoing.updateDate(fields.date)
      incoming.updateDate(fields.date)
    }

    const hasNewExchangeRate =
      fields.originalAmount != null &&
      fields.originalCurrency != null &&
      fields.exchangeRate != null

    if (fields.amount !== undefined) {
      outgoing.updateAmount(fields.amount)
      if (hasNewExchangeRate) {
        incoming.updateAmount(fields.originalAmount!)
      } else {
        incoming.updateAmount(fields.amount)
      }
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
        outgoing.clearExchangeRate()
      } else {
        outgoing.updateExchangeRate(
          fields.originalAmount,
          fields.originalCurrency,
          fields.exchangeRate
        )
        if (fields.amount === undefined) {
          incoming.updateAmount(fields.originalAmount)
        }
      }
    }

    return this.transactionRepo.saveTransferPair(outgoing, incoming)
  }
}
