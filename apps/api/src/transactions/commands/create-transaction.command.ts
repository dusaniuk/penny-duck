import {
  Command,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from "@nestjs/cqrs"
import { BadRequestException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import { TransactionCreatedEvent } from "../events/transaction-created.event"
import {
  toResponse,
  validateExchangeRate,
} from "../helpers/transaction.helpers"

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

export class CreateTransactionCommand extends Command<Transaction> {
  constructor(public readonly input: CreateTransactionInput) {
    super()
  }
}

@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<CreateTransactionCommand> {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(cmd: CreateTransactionCommand): Promise<Transaction> {
    const { input } = cmd

    if (input.amount <= 0)
      throw new BadRequestException("Amount must be greater than 0")
    if (input.type !== "transfer" && !input.categoryId) {
      throw new BadRequestException(
        "Category is required for expense and income transactions"
      )
    }
    if (input.myShare != null) {
      if (input.myShare <= 0)
        throw new BadRequestException("My share must be greater than 0")
      if (input.myShare >= input.amount)
        throw new BadRequestException(
          "My share must be less than the total amount"
        )
    }
    validateExchangeRate(
      input.originalAmount,
      input.originalCurrency,
      input.exchangeRate
    )

    const settled = input.myShare != null ? false : true

    const row = await this.transactionRepo.insert({
      userId: input.userId,
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
      date: input.date,
      myShare: input.myShare ?? null,
      settled,
      originalAmount: input.originalAmount ?? null,
      originalCurrency: input.originalCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
      transferId: null,
    })

    this.eventBus.publish(
      new TransactionCreatedEvent(
        row.accountId,
        input.type === "expense" ? "expense" : "income",
        row.amount
      )
    )

    return toResponse(row)
  }
}
