import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import {
  toResponse,
  validateExchangeRate,
} from "../helpers/transaction.helpers"

export interface CreateTransactionInput {
  organizationId: string
  accountId: string
  type: string
  amount: number
  categoryId: string | null
  date: Date
  note?: string | null
  settled?: boolean
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
  madeById: string
}

export class CreateTransactionCommand extends Command<Transaction> {
  constructor(public readonly input: CreateTransactionInput) {
    super()
  }
}

@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<CreateTransactionCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: CreateTransactionCommand): Promise<Transaction> {
    const { input } = cmd

    if (input.amount <= 0)
      throw new BadRequestException("Amount must be greater than 0")
    if (!input.categoryId) {
      throw new BadRequestException(
        "Category is required for expense and income transactions"
      )
    }
    validateExchangeRate(
      input.originalAmount,
      input.originalCurrency,
      input.exchangeRate
    )

    const isMember = await this.transactionRepo.isMemberOfOrg(
      input.madeById,
      input.organizationId
    )
    if (!isMember)
      throw new BadRequestException("User is not a member of this organization")

    const dbAmount = input.type === "expense" ? -input.amount : input.amount

    const row = await this.transactionRepo.insert({
      organizationId: input.organizationId,
      accountId: input.accountId,
      amount: dbAmount,
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
      date: input.date,
      settled: input.settled ?? true,
      originalAmount: input.originalAmount ?? null,
      originalCurrency: input.originalCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
      transferId: null,
      reimbursementId: null,
      madeById: input.madeById,
    })

    return toResponse(row)
  }
}
