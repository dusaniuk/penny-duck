import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import {
  AccountNotFoundError,
  InvalidDeleteModeError,
} from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"
import { TransactionRepository } from "../../transactions/domain/repositories/transaction.repository"

export type DeleteMode = "move" | "orphan" | "delete"

export interface DeleteAccountInput {
  id: string
  userId: string
  mode: DeleteMode
  targetAccountId?: string
}

export class DeleteAccountCommand {
  constructor(public readonly input: DeleteAccountInput) {}
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  implements ICommandHandler<DeleteAccountCommand>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const { id, userId, mode, targetAccountId } = command.input

    const account = await this.accountRepo.findById(id, userId)
    if (!account) throw new AccountNotFoundError()

    if (mode === "move") {
      if (!targetAccountId)
        throw new InvalidDeleteModeError(
          "Target account is required for move mode"
        )
      if (targetAccountId === id)
        throw new InvalidDeleteModeError(
          "Target account must differ from source"
        )

      const target = await this.accountRepo.findById(targetAccountId, userId)
      if (!target) throw new InvalidDeleteModeError("Target account not found")

      const txs = await this.transactionRepo.findAllByAccountId(id)
      let balanceDelta = 0
      for (const t of txs) {
        if (t.type === "expense") balanceDelta -= t.amount
        else if (t.type === "income") balanceDelta += t.amount
        else if (t.type === "transfer") {
          if (t.exchangeRate != null) balanceDelta -= t.amount
          else balanceDelta += t.amount
        }
      }

      await this.transactionRepo.updateAccountIdBulk(id, targetAccountId)

      target.adjustBalance(balanceDelta)
      await this.accountRepo.save(target)
    } else if (mode === "orphan") {
      await this.breakTransferLinksForAccount(id)
      await this.transactionRepo.updateAccountIdBulk(id, null)
    } else if (mode === "delete") {
      await this.breakTransferLinksForAccount(id)
      await this.transactionRepo.deleteByAccountId(id)
    }

    await this.accountRepo.delete(id, userId)
  }

  private async breakTransferLinksForAccount(
    accountId: string
  ): Promise<void> {
    const txs = await this.transactionRepo.findAllByAccountId(accountId)
    const transferTxs = txs.filter((t) => t.transferId != null)

    for (const t of transferTxs) {
      const pair = await this.transactionRepo.findByTransferId(t.transferId!)
      const partner = pair.find((p) => p.id !== t.id)

      if (partner) {
        partner.breakTransferLink()
        await this.transactionRepo.save(partner)
      }

      t.breakTransferLink()
      await this.transactionRepo.save(t)
    }
  }
}
