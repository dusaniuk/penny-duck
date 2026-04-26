import { Inject, NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { sql } from "drizzle-orm"
import { type DbClient } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { TradeRepository } from "../trade.repository"
import { assertNonNegative } from "../helpers/assert-non-negative"

export class DeleteTradeCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteTradeCommand)
export class DeleteTradeHandler implements ICommandHandler<DeleteTradeCommand> {
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly tradeRepo: TradeRepository
  ) {}

  async execute(cmd: DeleteTradeCommand): Promise<void> {
    const existing = await this.tradeRepo.findById(cmd.id, cmd.organizationId)
    if (!existing) throw new NotFoundException("Trade not found")

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${existing.accountId})::bigint << 32 |
          (hashtext(${existing.instrumentId})::bigint & x'FFFFFFFF'::bigint)
        )
      `)

      await this.tradeRepo.delete(cmd.id, cmd.organizationId, tx)

      const remaining = await this.tradeRepo.findAllForReplay(
        existing.accountId,
        existing.instrumentId,
        tx
      )
      assertNonNegative(
        remaining.map((t) => ({
          type: t.type as "buy" | "sell" | "dividend",
          quantity: t.quantity,
          price: t.price,
          fees: t.fees,
          date: t.date,
          createdAt: t.createdAt,
        }))
      )
    })
  }
}
