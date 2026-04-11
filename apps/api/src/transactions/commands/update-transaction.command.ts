import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import {
  toResponse,
  validateExchangeRate,
} from "../helpers/transaction.helpers"

interface UpdateFields {
  accountId?: string
  amount?: number
  categoryId?: string | null
  note?: string | null
  date?: Date
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class UpdateTransactionCommand extends Command<Transaction> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly fields: UpdateFields
  ) {
    super()
  }
}

@CommandHandler(UpdateTransactionCommand)
export class UpdateTransactionHandler implements ICommandHandler<UpdateTransactionCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: UpdateTransactionCommand): Promise<Transaction> {
    const existing = await this.transactionRepo.findById(cmd.id, cmd.organizationId)
    if (!existing) throw new NotFoundException("Transaction not found")
    if (existing.transferId)
      throw new BadRequestException(
        "Use the transfer endpoint to modify transfer transactions"
      )

    const { fields } = cmd
    const updateData: Record<string, unknown> = {}

    if (fields.accountId !== undefined && fields.accountId !== existing.accountId) {
      updateData.accountId = fields.accountId
    }

    if (fields.amount !== undefined) {
      if (fields.amount <= 0)
        throw new BadRequestException("Amount must be greater than 0")
      updateData.amount = existing.amount < 0 ? -fields.amount : fields.amount
    }
    if (fields.categoryId !== undefined) {
      if (!existing.transferId && fields.categoryId === null) {
        throw new BadRequestException(
          "Category is required for expense and income transactions"
        )
      }
      updateData.categoryId = fields.categoryId
    }
    if (fields.note !== undefined) updateData.note = fields.note
    if (fields.date !== undefined) updateData.date = fields.date

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

    const row = await this.transactionRepo.update(cmd.id, cmd.organizationId, updateData)

    return toResponse(row)
  }
}
