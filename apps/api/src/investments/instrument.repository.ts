import { Inject, Injectable } from "@nestjs/common"
import { eq, inArray, sql } from "drizzle-orm"
import { type DbClient, instruments } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type InstrumentRow = typeof instruments.$inferSelect

@Injectable()
export class InstrumentRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findBySymbol(symbol: string): Promise<InstrumentRow | null> {
    const rows = await this.db
      .select()
      .from(instruments)
      .where(eq(instruments.symbol, symbol.toUpperCase()))
      .limit(1)
    return rows[0] ?? null
  }

  async findById(id: string): Promise<InstrumentRow | null> {
    const rows = await this.db.select().from(instruments).where(eq(instruments.id, id)).limit(1)
    return rows[0] ?? null
  }

  async findByIds(ids: string[]): Promise<InstrumentRow[]> {
    if (ids.length === 0) return []
    return this.db.select().from(instruments).where(inArray(instruments.id, ids))
  }

  async searchLocal(query: string, limit = 10): Promise<InstrumentRow[]> {
    const like = `%${query}%`
    return this.db
      .select()
      .from(instruments)
      .where(sql`(${instruments.symbol} ILIKE ${like} OR ${instruments.name} ILIKE ${like})`)
      .limit(limit)
  }

  async upsert(data: {
    symbol: string
    name: string
    exchange: string | null
    currency: string
    lastPrice: number
    lastPricedAt: Date
  }): Promise<InstrumentRow> {
    const [row] = await this.db
      .insert(instruments)
      .values({
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        exchange: data.exchange,
        currency: data.currency,
        lastPrice: data.lastPrice,
        lastPricedAt: data.lastPricedAt,
      })
      .onConflictDoUpdate({
        target: instruments.symbol,
        set: {
          name: data.name,
          exchange: data.exchange,
          currency: data.currency,
          lastPrice: data.lastPrice,
          lastPricedAt: data.lastPricedAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }

  async updatePrice(id: string, price: number, at: Date): Promise<void> {
    await this.db
      .update(instruments)
      .set({ lastPrice: price, lastPricedAt: at, updatedAt: new Date() })
      .where(eq(instruments.id, id))
  }

  async findAllReferenced(organizationId: string): Promise<InstrumentRow[]> {
    const rows = await this.db.execute(sql`
      SELECT DISTINCT i.*
      FROM app.instruments i
      JOIN app.trades t ON t.instrument_id = i.id
      WHERE t.organization_id = ${organizationId}
    `)
    return rows.rows as unknown as InstrumentRow[]
  }
}
