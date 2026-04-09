import { BadRequestException, NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import { toResponse } from "../helpers/transaction.helpers"

export class SettleTransactionCommand extends Command<Transaction> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(SettleTransactionCommand)
export class SettleTransactionHandler implements ICommandHandler<SettleTransactionCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: SettleTransactionCommand): Promise<Transaction> {
    const row = await this.transactionRepo.findById(cmd.id, cmd.userId)
    if (!row) throw new NotFoundException("Transaction not found")
    if (row.myShare == null)
      throw new BadRequestException("Can only settle shared transactions")

    const updated = await this.transactionRepo.update(cmd.id, { settled: true })
    return toResponse(updated)
  }
}
