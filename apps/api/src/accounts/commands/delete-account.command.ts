import { ConflictException, Inject, NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { asc, eq } from "drizzle-orm"
import { type DbClient, trades } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { countOpenPositionsFromTrades } from "@/hono/modules/investments/helpers/count-open-positions"
import { AccountRepository } from "../account.repository"
import { TransactionRepository } from "../../transactions/transaction.repository"

export class DeleteAccountCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  implements ICommandHandler<DeleteAccountCommand>
{
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(cmd: DeleteAccountCommand): Promise<void> {
    const account = await this.accountRepo.findById(cmd.id, cmd.organizationId, cmd.userId)
    if (!account) throw new NotFoundException("Account not found")

    const tradeRows = await this.db
      .select()
      .from(trades)
      .where(eq(trades.accountId, cmd.id))
      .orderBy(asc(trades.date), asc(trades.createdAt))
    const openCount = countOpenPositionsFromTrades(
      tradeRows.map((t) => ({
        instrumentId: t.instrumentId,
        type: t.type as "buy" | "sell" | "dividend",
        quantity: t.quantity,
        price: t.price,
        fees: t.fees,
        date: t.date,
        createdAt: t.createdAt,
      }))
    )
    if (openCount > 0) {
      throw new ConflictException(
        `Account has ${openCount} position${openCount !== 1 ? "s" : ""} and cannot be deleted`
      )
    }

    const count = await this.transactionRepo.countByAccountId(cmd.id)
    if (count > 0)
      throw new ConflictException(
        `Account has ${count} transaction${count !== 1 ? "s" : ""} and cannot be deleted`
      )

    await this.accountRepo.delete(cmd.id, cmd.organizationId)
  }
}
