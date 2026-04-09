import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event"
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event"

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
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

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
    const oldOutgoingAmount = outgoing.amount
    const oldIncomingAmount = incoming.amount

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

    const saved = await this.transactionRepo.saveTransferPair(outgoing, incoming)

    // Publish balance delta events for each side that changed
    this.publishBalanceDelta(
      outgoing.accountId,
      oldOutgoingAmount,
      outgoing.amount,
      "expense"
    )
    this.publishBalanceDelta(
      incoming.accountId,
      oldIncomingAmount,
      incoming.amount,
      "income"
    )

    return saved
  }

  private publishBalanceDelta(
    accountId: string | null,
    oldAmount: number,
    newAmount: number,
    direction: "expense" | "income"
  ): void {
    if (!accountId || oldAmount === newAmount) return

    // For expense (outgoing): old subtracted oldAmount, new subtracts newAmount
    //   → delta = oldAmount - newAmount (positive = balance increases)
    // For income (incoming): old added oldAmount, new adds newAmount
    //   → delta = newAmount - oldAmount (positive = balance increases)
    const delta =
      direction === "expense"
        ? oldAmount - newAmount
        : newAmount - oldAmount

    if (delta > 0) {
      this.eventBus.publish(
        new TransactionDeletedEvent(accountId, "expense", delta)
      )
    } else if (delta < 0) {
      this.eventBus.publish(
        new TransactionCreatedEvent(accountId, "expense", -delta)
      )
    }
  }
}
