import {
  Command,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../../repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../events/transaction-created.event"
import { TransactionDeletedEvent } from "../../events/transaction-deleted.event"
import {
  toResponse,
  validateExchangeRate,
} from "../../helpers/transaction.helpers"

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

export class UpdateTransactionCommand extends Command<Transaction> {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly fields: UpdateFields
  ) {
    super()
  }
}

@CommandHandler(UpdateTransactionCommand)
export class UpdateTransactionHandler
  implements ICommandHandler<UpdateTransactionCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(cmd: UpdateTransactionCommand): Promise<Transaction> {
    const existing = await this.transactionRepo.findById(cmd.id, cmd.userId)
    if (!existing) throw new NotFoundException("Transaction not found")
    if (existing.type === "transfer")
      throw new BadRequestException(
        "Use the transfer endpoint to modify transfer transactions"
      )

    const { fields } = cmd
    const updateData: Record<string, unknown> = {}

    if (fields.accountId !== undefined && existing.accountId === null) {
      updateData.accountId = fields.accountId
      this.eventBus.publish(
        new TransactionCreatedEvent(
          fields.accountId,
          existing.type === "expense" ? "expense" : "income",
          existing.amount
        )
      )
    }

    const oldAmount = existing.amount
    if (fields.amount !== undefined) {
      if (fields.amount <= 0) throw new Error("Amount must be greater than 0")
      updateData.amount = fields.amount
    }
    if (fields.categoryId !== undefined) {
      if (existing.type !== "transfer" && fields.categoryId === null) {
        throw new Error(
          "Category is required for expense and income transactions"
        )
      }
      updateData.categoryId = fields.categoryId
    }
    if (fields.note !== undefined) updateData.note = fields.note
    if (fields.date !== undefined) updateData.date = fields.date

    if (fields.myShare === null) {
      updateData.myShare = null
      updateData.settled = true
    } else if (fields.myShare !== undefined) {
      const effectiveAmount = fields.amount ?? existing.amount
      if (fields.myShare <= 0)
        throw new Error("My share must be greater than 0")
      if (fields.myShare >= effectiveAmount)
        throw new Error("My share must be less than the total amount")
      updateData.myShare = fields.myShare
      updateData.settled = false
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
        updateData.originalAmount = null
        updateData.originalCurrency = null
        updateData.exchangeRate = null
      } else {
        validateExchangeRate(
          fields.originalAmount,
          fields.originalCurrency,
          fields.exchangeRate
        )
        updateData.originalAmount = fields.originalAmount
        updateData.originalCurrency = fields.originalCurrency
        updateData.exchangeRate = fields.exchangeRate
      }
    }

    const row = await this.transactionRepo.update(cmd.id, updateData)

    if (
      fields.amount !== undefined &&
      fields.amount !== oldAmount &&
      row.accountId
    ) {
      const delta =
        row.type === "expense"
          ? oldAmount - row.amount
          : row.amount - oldAmount

      if (delta > 0) {
        this.eventBus.publish(
          new TransactionDeletedEvent(row.accountId, "expense", delta)
        )
      } else if (delta < 0) {
        this.eventBus.publish(
          new TransactionCreatedEvent(row.accountId, "expense", -delta)
        )
      }
    }

    return toResponse(row)
  }
}
