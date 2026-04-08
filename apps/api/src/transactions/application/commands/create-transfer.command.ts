import { randomUUID } from "crypto"
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { InvalidTransferError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event"

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

export class CreateTransferCommand {
  constructor(public readonly input: CreateTransferInput) {}
}

@CommandHandler(CreateTransferCommand)
export class CreateTransferHandler
  implements ICommandHandler<CreateTransferCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(
    command: CreateTransferCommand
  ): Promise<[Transaction, Transaction]> {
    if (command.input.fromAccountId === command.input.toAccountId)
      throw new InvalidTransferError(
        "Source and destination accounts must differ"
      )

    const transferId = randomUUID()

    const hasExchangeRate =
      command.input.originalAmount != null &&
      command.input.originalCurrency != null &&
      command.input.exchangeRate != null

    const incomingAmount = hasExchangeRate
      ? command.input.originalAmount!
      : command.input.amount

    const outgoing = Transaction.createTransferSide({
      userId: command.input.userId,
      accountId: command.input.fromAccountId,
      amount: command.input.amount,
      date: command.input.date,
      note: command.input.note,
      transferId,
      originalAmount: command.input.originalAmount,
      originalCurrency: command.input.originalCurrency,
      exchangeRate: command.input.exchangeRate,
    })

    const incoming = Transaction.createTransferSide({
      userId: command.input.userId,
      accountId: command.input.toAccountId,
      amount: incomingAmount,
      date: command.input.date,
      note: command.input.note,
      transferId,
    })

    const [savedOutgoing, savedIncoming] =
      await this.transactionRepo.saveTransferPair(outgoing, incoming)

    this.eventBus.publish(
      new TransactionCreatedEvent(
        savedOutgoing.accountId!,
        "expense",
        savedOutgoing.amount
      )
    )
    this.eventBus.publish(
      new TransactionCreatedEvent(
        savedIncoming.accountId!,
        "income",
        savedIncoming.amount
      )
    )

    return [savedOutgoing, savedIncoming]
  }
}
