import {
  Inject,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { and, eq, sql } from "drizzle-orm"
import { type Trade } from "@workspace/api-contract"
import { type DbClient, accounts } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { InstrumentService } from "../instrument.service"
import { TradeRepository } from "../trade.repository"
import { toTradeResponse } from "../helpers/investments.helpers"
import { assertNonNegative } from "../helpers/assert-non-negative"
import { type ReplayTrade } from "../helpers/replay-position"

export interface CreateTradeInput {
  organizationId: string
  accountId: string
  symbol: string
  type: "buy" | "sell" | "dividend"
  quantity?: number
  price?: number
  amount?: number
  fees?: number
  withheldTax?: number
  date: Date
  externalSource?: string
  externalId?: string
  externalMetadata?: Record<string, unknown>
}

export class CreateTradeCommand extends Command<Trade> {
  constructor(public readonly input: CreateTradeInput) {
    super()
  }
}

@CommandHandler(CreateTradeCommand)
export class CreateTradeHandler implements ICommandHandler<CreateTradeCommand> {
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly instrumentService: InstrumentService,
    private readonly tradeRepo: TradeRepository
  ) {}

  async execute(cmd: CreateTradeCommand): Promise<Trade> {
    const { input } = cmd

    if (input.date.getTime() > Date.now()) {
      throw new BadRequestException("Future-dated trades are not allowed")
    }

    const [accountRow] = await this.db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, input.accountId), eq(accounts.organizationId, input.organizationId))
      )
      .limit(1)
    if (!accountRow) throw new NotFoundException("Account not found")
    if (accountRow.type !== "brokerage") {
      throw new BadRequestException("Trades require a brokerage-type account")
    }

    const instrument = await this.instrumentService.ensureBySymbol(input.symbol)

    const fees = input.fees ?? 0
    const withheldTax = input.withheldTax ?? 0
    let quantity: number | null
    let price: number | null
    let amount: number

    if (input.type === "buy" || input.type === "sell") {
      if (input.quantity == null || input.price == null) {
        throw new BadRequestException("Buy/sell requires quantity and price")
      }
      if (instrument.currency !== accountRow.currency) {
        throw new BadRequestException(
          `Instrument currency (${instrument.currency}) does not match account currency (${accountRow.currency})`
        )
      }
      quantity = input.quantity
      price = input.price
      const gross = input.quantity * input.price
      amount = input.type === "buy" ? gross + fees : gross - fees
    } else {
      if (input.amount == null) {
        throw new BadRequestException("Dividend requires amount")
      }
      quantity = null
      price = null
      amount = input.amount
    }

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${input.accountId})::bigint << 32 |
          (hashtext(${instrument.id})::bigint & x'FFFFFFFF'::bigint)
        )
      `)

      if (input.type === "sell") {
        const existing = await this.tradeRepo.findAllForReplay(
          input.accountId,
          instrument.id,
          tx
        )
        const proposed: ReplayTrade = {
          type: "sell",
          quantity,
          price,
          fees,
          date: input.date,
          createdAt: new Date(),
        }
        assertNonNegative([
          ...existing.map((t) => ({
            type: t.type as "buy" | "sell" | "dividend",
            quantity: t.quantity,
            price: t.price,
            fees: t.fees,
            date: t.date,
            createdAt: t.createdAt,
          })),
          proposed,
        ])
      }

      const tradeRow = await this.tradeRepo.insert(
        {
          organizationId: input.organizationId,
          accountId: input.accountId,
          instrumentId: instrument.id,
          type: input.type,
          quantity,
          price,
          amount,
          fees,
          withheldTax: input.type === "dividend" ? withheldTax : null,
          date: input.date,
          externalSource: input.externalSource ?? null,
          externalId: input.externalId ?? null,
          externalMetadata: input.externalMetadata ?? null,
        },
        tx
      )

      return toTradeResponse(tradeRow, instrument.symbol)
    })
  }
}
