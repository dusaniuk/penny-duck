import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { NotFoundException } from "@nestjs/common"
import { TransactionRepository } from "../transaction.repository"

export class DeleteTransferCommand extends Command<void> {
  constructor(
    public readonly transferId: string,
    public readonly organizationId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteTransferCommand)
export class DeleteTransferHandler implements ICommandHandler<DeleteTransferCommand> {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: DeleteTransferCommand): Promise<void> {
    const pair = await this.transactionRepo.findByTransferId(cmd.transferId, cmd.organizationId)
    if (pair.length !== 2) throw new NotFoundException("Transaction not found")

    await this.transactionRepo.deleteByTransferId(cmd.transferId, cmd.organizationId)
  }
}
