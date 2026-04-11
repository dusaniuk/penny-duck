import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { TransactionRepository } from "../transaction.repository"
import { toResponse } from "../helpers/transaction.helpers"

export class SettleTransactionCommand extends Command<Transaction> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string
  ) {
    super()
  }
}

@CommandHandler(SettleTransactionCommand)
export class SettleTransactionHandler implements ICommandHandler<SettleTransactionCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: SettleTransactionCommand): Promise<Transaction> {
    const row = await this.transactionRepo.findById(cmd.id, cmd.organizationId)
    if (!row) throw new NotFoundException("Transaction not found")

    const updated = await this.transactionRepo.update(cmd.id, cmd.organizationId, {
      settled: !row.settled,
    })
    return toResponse(updated)
  }
}
