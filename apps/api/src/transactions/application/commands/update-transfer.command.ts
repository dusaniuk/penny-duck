import {
  Command,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionNotFoundError } from "../../errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../events/transaction-created.event"
import { TransactionDeletedEvent } from "../../events/transaction-deleted.event"
import {
  toResponse,
  validateExchangeRate,
} from "../../helpers/transaction.helpers"

interface UpdateTransferFields {
  amount?: number
  date?: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class UpdateTransferCommand extends Command<
  [Transaction, Transaction]
> {
  constructor(
    public readonly transferId: string,
    public readonly userId: string,
    public readonly fields: UpdateTransferFields
  ) {
    super()
  }
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
    cmd: UpdateTransferCommand
  ): Promise<[Transaction, Transaction]> {
    const pair = await this.transactionRepo.findByTransferId(cmd.transferId)
    if (pair.length !== 2) throw new TransactionNotFoundError()

    const outgoing =
      pair.find((t) => t.originalAmount !== null) ?? pair[0]
    const incoming = pair.find((t) => t !== outgoing)!

    const { fields } = cmd
    const oldOutgoingAmount = outgoing.amount
    const oldIncomingAmount = incoming.amount

    const outgoingUpdate: Record<string, unknown> = {}
    const incomingUpdate: Record<string, unknown> = {}

    if (fields.note !== undefined) {
      outgoingUpdate.note = fields.note
      incomingUpdate.note = fields.note
    }
    if (fields.date !== undefined) {
      outgoingUpdate.date = fields.date
      incomingUpdate.date = fields.date
    }

    const hasNewExchangeRate =
      fields.originalAmount != null &&
      fields.originalCurrency != null &&
      fields.exchangeRate != null

    if (fields.amount !== undefined) {
      if (fields.amount <= 0) throw new Error("Amount must be greater than 0")
      outgoingUpdate.amount = fields.amount
      if (hasNewExchangeRate) {
        incomingUpdate.amount = fields.originalAmount!
      } else {
        incomingUpdate.amount = fields.amount
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
        outgoingUpdate.originalAmount = null
        outgoingUpdate.originalCurrency = null
        outgoingUpdate.exchangeRate = null
      } else {
        validateExchangeRate(
          fields.originalAmount,
          fields.originalCurrency,
          fields.exchangeRate
        )
        outgoingUpdate.originalAmount = fields.originalAmount
        outgoingUpdate.originalCurrency = fields.originalCurrency
        outgoingUpdate.exchangeRate = fields.exchangeRate
        if (fields.amount === undefined) {
          incomingUpdate.amount = fields.originalAmount
        }
      }
    }

    const [outRow, inRow] = await this.transactionRepo.updateTransferPair(
      outgoing.id,
      outgoingUpdate,
      incoming.id,
      incomingUpdate
    )

    this.publishBalanceDelta(
      outgoing.accountId,
      oldOutgoingAmount,
      outRow.amount,
      "expense"
    )
    this.publishBalanceDelta(
      incoming.accountId,
      oldIncomingAmount,
      inRow.amount,
      "income"
    )

    return [toResponse(outRow), toResponse(inRow)]
  }

  private publishBalanceDelta(
    accountId: string | null,
    oldAmount: number,
    newAmount: number,
    direction: "expense" | "income"
  ): void {
    if (!accountId || oldAmount === newAmount) return

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
