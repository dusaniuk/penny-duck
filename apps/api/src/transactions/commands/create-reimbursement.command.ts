import { randomUUID } from "crypto"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { AccountRepository } from "../../accounts/account.repository"
import { TransactionRepository } from "../transaction.repository"
import { toResponse } from "../helpers/transaction.helpers"

export interface CreateReimbursementInput {
  transactionId: string
  userId: string
  accountId: string
  amount: number
  date: Date
  exchangeRate?: number | null
}

export class CreateReimbursementCommand extends Command<Transaction> {
  constructor(public readonly input: CreateReimbursementInput) {
    super()
  }
}

@CommandHandler(CreateReimbursementCommand)
export class CreateReimbursementHandler
  implements ICommandHandler<CreateReimbursementCommand>
{
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository
  ) {}

  async execute(cmd: CreateReimbursementCommand): Promise<Transaction> {
    const { input } = cmd

    if (input.amount <= 0)
      throw new BadRequestException("Amount must be greater than 0")

    const expense = await this.transactionRepo.findById(
      input.transactionId,
      input.userId
    )
    if (!expense) throw new NotFoundException("Transaction not found")
    if (expense.amount >= 0)
      throw new BadRequestException("Can only reimburse expenses")

    const receivingAccount = await this.accountRepo.findById(
      input.accountId,
      input.userId
    )
    if (!receivingAccount) throw new NotFoundException("Account not found")

    const isSameAccount = input.accountId === expense.accountId

    // Calculate the reimbursement amount in the expense's currency
    let amountInExpenseCurrency: number
    if (isSameAccount) {
      amountInExpenseCurrency = input.amount
    } else {
      const expenseAccount = await this.accountRepo.findById(
        expense.accountId,
        input.userId
      )
      if (!expenseAccount) throw new NotFoundException("Account not found")

      if (expenseAccount.currency === receivingAccount.currency) {
        amountInExpenseCurrency = input.amount
      } else {
        if (!input.exchangeRate)
          throw new BadRequestException(
            "Exchange rate is required for cross-currency reimbursements"
          )
        amountInExpenseCurrency = input.amount * input.exchangeRate
      }
    }

    // Round to cents to avoid floating point issues
    amountInExpenseCurrency = Math.round(amountInExpenseCurrency * 100) / 100

    // Validate cap: can't reimburse more than the current expense amount
    const currentExpenseAmount = Math.abs(expense.amount)
    if (amountInExpenseCurrency >= currentExpenseAmount)
      throw new BadRequestException(
        "Reimbursement exceeds remaining expense amount"
      )

    // Reduce the expense amount
    const newExpenseAmount = -(currentExpenseAmount - amountInExpenseCurrency)

    if (isSameAccount) {
      // Same account: just update the expense amount, no transfer needed
      const updated = await this.transactionRepo.update(input.transactionId, {
        amount: newExpenseAmount,
      })
      return toResponse(updated)
    }

    // Cross-account: update expense + create transfer pair
    const transferId = randomUUID()

    const expenseAccount = await this.accountRepo.findById(
      expense.accountId,
      input.userId
    )
    const isCrossCurrency =
      expenseAccount!.currency !== receivingAccount.currency

    await this.transactionRepo.insertTransferPair(
      {
        userId: input.userId,
        accountId: expense.accountId,
        amount: -amountInExpenseCurrency,
        categoryId: null,
        note: expense.note,
        date: input.date,
        settled: true,
        originalAmount: isCrossCurrency ? input.amount : null,
        originalCurrency: isCrossCurrency ? receivingAccount.currency : null,
        exchangeRate: isCrossCurrency ? input.exchangeRate! : null,
        transferId,
        reimbursementId: input.transactionId,
      },
      {
        userId: input.userId,
        accountId: input.accountId,
        amount: input.amount,
        categoryId: null,
        note: expense.note,
        date: input.date,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId,
        reimbursementId: input.transactionId,
      }
    )

    // Update the expense amount
    const updated = await this.transactionRepo.update(input.transactionId, {
      amount: newExpenseAmount,
    })

    return toResponse(updated)
  }
}
