import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, gte, inArray, lte, SQL } from "drizzle-orm"
import { type DbClient, trades, instruments } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type TradeRow = typeof trades.$inferSelect
export type TradeWithSymbol = TradeRow & { symbol: string }

type TradeExecutor =
  | DbClient
  | Parameters<Parameters<DbClient["transaction"]>[0]>[0]

export interface ListTradesFilters {
  organizationId: string
  accountId?: string
  symbol?: string
  type?: string
  from?: Date
  to?: Date
}

@Injectable()
export class TradeRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async insert(
    data: {
      organizationId: string
      accountId: string
      instrumentId: string
      type: string
      quantity: number | null
      price: number | null
      amount: number
      fees: number
      withheldTax?: number | null
      date: Date
      externalSource?: string | null
      externalId?: string | null
      externalMetadata?: Record<string, unknown> | null
    },
    executor: TradeExecutor = this.db
  ): Promise<TradeRow> {
    const [row] = await executor.insert(trades).values(data).returning()
    return row
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      quantity?: number | null
      price?: number | null
      amount?: number
      fees?: number
      date?: Date
      instrumentId?: string
    },
    executor: TradeExecutor = this.db
  ): Promise<TradeRow> {
    const [row] = await executor
      .update(trades)
      .set(data)
      .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
      .returning()
    return row
  }

  async findById(id: string, organizationId: string): Promise<TradeRow | null> {
    const rows = await this.db
      .select()
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
      .limit(1)
    return rows[0] ?? null
  }

  async findAllForReplay(
    accountId: string,
    instrumentId: string,
    executor: TradeExecutor = this.db
  ): Promise<TradeRow[]> {
    return executor
      .select()
      .from(trades)
      .where(and(eq(trades.accountId, accountId), eq(trades.instrumentId, instrumentId)))
      .orderBy(asc(trades.date), asc(trades.createdAt))
  }

  async findAllByOrg(organizationId: string): Promise<TradeRow[]> {
    return this.db
      .select()
      .from(trades)
      .where(eq(trades.organizationId, organizationId))
      .orderBy(asc(trades.accountId), asc(trades.instrumentId), asc(trades.date), asc(trades.createdAt))
  }

  async findAllByAccount(accountId: string): Promise<TradeRow[]> {
    return this.db
      .select()
      .from(trades)
      .where(eq(trades.accountId, accountId))
      .orderBy(asc(trades.date), asc(trades.createdAt))
  }

  async findExistingExternalIds(
    accountId: string,
    externalSource: string,
    externalIds: string[]
  ): Promise<Set<string>> {
    if (externalIds.length === 0) return new Set()
    const rows = await this.db
      .select({ externalId: trades.externalId })
      .from(trades)
      .where(
        and(
          eq(trades.accountId, accountId),
          eq(trades.externalSource, externalSource),
          inArray(trades.externalId, externalIds)
        )
      )
    return new Set(rows.map((r) => r.externalId).filter((v): v is string => v !== null))
  }

  async delete(
    id: string,
    organizationId: string,
    executor: TradeExecutor = this.db
  ): Promise<void> {
    await executor
      .delete(trades)
      .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
  }

  async findAll(filters: ListTradesFilters): Promise<TradeWithSymbol[]> {
    const conditions: SQL[] = [eq(trades.organizationId, filters.organizationId)]
    if (filters.accountId) conditions.push(eq(trades.accountId, filters.accountId))
    if (filters.type) conditions.push(eq(trades.type, filters.type))
    if (filters.from) conditions.push(gte(trades.date, filters.from))
    if (filters.to) conditions.push(lte(trades.date, filters.to))

    if (filters.symbol) {
      const matching = await this.db
        .select({ id: instruments.id })
        .from(instruments)
        .where(eq(instruments.symbol, filters.symbol.toUpperCase()))
      const instrumentIds = matching.map((r) => r.id)
      if (instrumentIds.length === 0) return []
      conditions.push(inArray(trades.instrumentId, instrumentIds))
    }

    const rows = await this.db
      .select({
        id: trades.id,
        organizationId: trades.organizationId,
        accountId: trades.accountId,
        instrumentId: trades.instrumentId,
        type: trades.type,
        quantity: trades.quantity,
        price: trades.price,
        amount: trades.amount,
        fees: trades.fees,
        withheldTax: trades.withheldTax,
        date: trades.date,
        externalSource: trades.externalSource,
        externalId: trades.externalId,
        externalMetadata: trades.externalMetadata,
        createdAt: trades.createdAt,
        symbol: instruments.symbol,
      })
      .from(trades)
      .leftJoin(instruments, eq(instruments.id, trades.instrumentId))
      .where(and(...conditions))
      .orderBy(desc(trades.date), desc(trades.createdAt))

    return rows.map((r) => ({ ...r, symbol: r.symbol ?? "" }))
  }
}
