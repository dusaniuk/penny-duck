import {
  Inject,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { eq, sql } from "drizzle-orm"
import { type Trade } from "@workspace/api-contract"
import { type DbClient, accounts, instruments } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { InstrumentService } from "../instrument.service"
import { TradeRepository } from "../trade.repository"
import { toTradeResponse } from "../helpers/investments.helpers"
import { assertNonNegative } from "../helpers/assert-non-negative"

export interface UpdateTradeInput {
  id: string
  organizationId: string
  symbol?: string
  quantity?: number
  price?: number
  amount?: number
  fees?: number
  date?: Date
}

export class UpdateTradeCommand extends Command<Trade> {
  constructor(public readonly input: UpdateTradeInput) {
    super()
  }
}

@CommandHandler(UpdateTradeCommand)
export class UpdateTradeHandler implements ICommandHandler<UpdateTradeCommand> {
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly instrumentService: InstrumentService,
    private readonly tradeRepo: TradeRepository
  ) {}

  async execute(cmd: UpdateTradeCommand): Promise<Trade> {
    const { input } = cmd

    if (input.date && input.date.getTime() > Date.now()) {
      throw new BadRequestException("Future-dated trades are not allowed")
    }

    const existing = await this.tradeRepo.findById(input.id, input.organizationId)
    if (!existing) throw new NotFoundException("Trade not found")

    let instrumentId = existing.instrumentId
    let instrumentCurrency: string | null = null
    if (input.symbol) {
      const inst = await this.instrumentService.ensureBySymbol(input.symbol)
      instrumentId = inst.id
      instrumentCurrency = inst.currency
    }

    const type = existing.type as "buy" | "sell" | "dividend"
    const fees = input.fees ?? existing.fees
    const date = input.date ?? existing.date
    let quantity = existing.quantity
    let price = existing.price
    let amount = existing.amount

    if (type === "buy" || type === "sell") {
      quantity = input.quantity ?? existing.quantity
      price = input.price ?? existing.price
      if (quantity == null || price == null) {
        throw new BadRequestException("Buy/sell requires quantity and price")
      }
      const gross = quantity * price
      amount = type === "buy" ? gross + fees : gross - fees
    } else {
      amount = input.amount ?? existing.amount
    }

    if (instrumentCurrency) {
      const [accountRow] = await this.db
        .select({ currency: accounts.currency })
        .from(accounts)
        .where(eq(accounts.id, existing.accountId))
        .limit(1)
      if (!accountRow) throw new NotFoundException("Account not found")
      if (instrumentCurrency !== accountRow.currency) {
        throw new BadRequestException(
          `Instrument currency (${instrumentCurrency}) does not match account currency (${accountRow.currency})`
        )
      }
    }

    return this.db.transaction(async (tx) => {
      const keys = Array.from(new Set([existing.instrumentId, instrumentId])).sort()
      for (const iid of keys) {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtext(${existing.accountId})::bigint << 32 |
            (hashtext(${iid})::bigint & x'FFFFFFFF'::bigint)
          )
        `)
      }

      const updated = await this.tradeRepo.update(
        input.id,
        input.organizationId,
        {
          instrumentId,
          quantity: type === "dividend" ? null : quantity,
          price: type === "dividend" ? null : price,
          amount,
          fees,
          date,
        },
        tx
      )

      for (const iid of keys) {
        const tradesForReplay = await this.tradeRepo.findAllForReplay(
          existing.accountId,
          iid,
          tx
        )
        assertNonNegative(
          tradesForReplay.map((t) => ({
            type: t.type as "buy" | "sell" | "dividend",
            quantity: t.quantity,
            price: t.price,
            fees: t.fees,
            date: t.date,
            createdAt: t.createdAt,
          }))
        )
      }

      const [newInst] = await tx
        .select({ symbol: instruments.symbol })
        .from(instruments)
        .where(eq(instruments.id, instrumentId))
        .limit(1)

      return toTradeResponse(updated, newInst?.symbol ?? "")
    })
  }
}
