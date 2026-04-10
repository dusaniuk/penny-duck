import { randomUUID } from "crypto"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { AccountRepository } from "../../accounts/account.repository"
import { TransactionRepository } from "../transaction.repository"
import {
  toResponse,
  validateExchangeRate,
} from "../helpers/transaction.helpers"

export interface CreateTransferInput {
  userId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
  note?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  exchangeRate?: number | null
}

export class CreateTransferCommand extends Command<[Transaction, Transaction]> {
  constructor(public readonly input: CreateTransferInput) {
    super()
  }
}

@CommandHandler(CreateTransferCommand)
export class CreateTransferHandler implements ICommandHandler<CreateTransferCommand> {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository
  ) {}

  async execute(
    cmd: CreateTransferCommand
  ): Promise<[Transaction, Transaction]> {
    const { input } = cmd

    if (input.fromAccountId === input.toAccountId) {
      throw new BadRequestException(
        "Source and destination accounts must differ"
      )
    }
    if (input.amount <= 0)
      throw new BadRequestException("Amount must be greater than 0")
    validateExchangeRate(
      input.originalAmount,
      input.originalCurrency,
      input.exchangeRate
    )

    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepo.findById(input.fromAccountId, input.userId),
      this.accountRepo.findById(input.toAccountId, input.userId),
    ])
    if (!fromAccount || !toAccount)
      throw new NotFoundException("Account not found")

    const transferId = randomUUID()

    const hasExchangeRate =
      input.originalAmount != null &&
      input.originalCurrency != null &&
      input.exchangeRate != null

    const incomingAmount = hasExchangeRate
      ? input.originalAmount!
      : input.amount

    const [outRow, inRow] = await this.transactionRepo.insertTransferPair(
      {
        userId: input.userId,
        accountId: input.fromAccountId,
        amount: -input.amount,
        categoryId: null,
        note: input.note ?? null,
        date: input.date,
        settled: true,
        originalAmount: input.originalAmount ?? null,
        originalCurrency: input.originalCurrency ?? null,
        exchangeRate: input.exchangeRate ?? null,
        transferId,
        reimbursementId: null,
      },
      {
        userId: input.userId,
        accountId: input.toAccountId,
        amount: incomingAmount,
        categoryId: null,
        note: input.note ?? null,
        date: input.date,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId,
        reimbursementId: null,
      }
    )

    return [toResponse(outRow), toResponse(inRow)]
  }
}
