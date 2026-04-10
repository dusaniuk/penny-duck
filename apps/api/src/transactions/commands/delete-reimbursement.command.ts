import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { TransactionRepository } from "../transaction.repository"

export class DeleteReimbursementCommand extends Command<void> {
  constructor(
    public readonly expenseId: string,
    public readonly reimbursementTransactionId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteReimbursementCommand)
export class DeleteReimbursementHandler
  implements ICommandHandler<DeleteReimbursementCommand>
{
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(cmd: DeleteReimbursementCommand): Promise<void> {
    const expense = await this.transactionRepo.findById(
      cmd.expenseId,
      cmd.userId
    )
    if (!expense) throw new NotFoundException("Transaction not found")

    const reimbursementTx = await this.transactionRepo.findById(
      cmd.reimbursementTransactionId,
      cmd.userId
    )
    if (!reimbursementTx || reimbursementTx.reimbursementId !== cmd.expenseId)
      throw new NotFoundException("Reimbursement not found")

    if (!reimbursementTx.transferId)
      throw new BadRequestException(
        "Same-account reimbursements cannot be individually deleted"
      )

    // Find the outgoing side of the transfer to get the reimbursed amount
    const pair = await this.transactionRepo.findByTransferId(
      reimbursementTx.transferId,
      cmd.userId
    )
    const outgoing = pair.find((t) => t.amount < 0)
    if (!outgoing) throw new NotFoundException("Transfer pair incomplete")

    // Restore the expense amount: expense.amount is negative, outgoing.amount is negative
    // e.g. expense = -70, outgoing = -30 => restored = -70 + (-30) = -100
    const restoredAmount = expense.amount + outgoing.amount
    await this.transactionRepo.update(cmd.expenseId, {
      amount: restoredAmount,
    })

    // Delete the transfer pair
    await this.transactionRepo.deleteByTransferId(
      reimbursementTx.transferId,
      cmd.userId
    )
  }
}
