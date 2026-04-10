import { Inject, Injectable } from "@nestjs/common"
import { eq, and, asc, sql, sum } from "drizzle-orm"
import { type DbClient, accounts, transactions } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type AccountRow = typeof accounts.$inferSelect & { balance: number }

@Injectable()
export class AccountRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  private balanceSubquery() {
    return this.db
      .select({
        accountId: transactions.accountId,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .groupBy(transactions.accountId)
      .as("balance_sq")
  }

  async findAllByUserId(userId: string): Promise<AccountRow[]> {
    const balanceSubquery = this.balanceSubquery()
    return this.db
      .select({
        id: accounts.id,
        userId: accounts.userId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        initialBalance: accounts.initialBalance,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        balance: sql<number>`(${accounts.initialBalance} + coalesce(${balanceSubquery.total}, 0))::float / 100`,
      })
      .from(accounts)
      .leftJoin(balanceSubquery, eq(balanceSubquery.accountId, accounts.id))
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.name))
  }

  async findById(id: string, userId: string): Promise<AccountRow | null> {
    const balanceSubquery = this.balanceSubquery()
    const rows = await this.db
      .select({
        id: accounts.id,
        userId: accounts.userId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        initialBalance: accounts.initialBalance,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        balance: sql<number>`(${accounts.initialBalance} + coalesce(${balanceSubquery.total}, 0))::float / 100`,
      })
      .from(accounts)
      .leftJoin(balanceSubquery, eq(balanceSubquery.accountId, accounts.id))
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1)
    return rows[0] ?? null
  }

  async insert(data: {
    userId: string
    name: string
    type: string
    currency: string
    initialBalance?: number
  }): Promise<AccountRow> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        userId: data.userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        initialBalance: data.initialBalance ?? 0,
      })
      .returning()
    return { ...row, balance: row.initialBalance }
  }

  async update(
    id: string,
    userId: string,
    data: { name?: string; type?: string }
  ): Promise<AccountRow> {
    await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id))
    const row = await this.findById(id, userId)
    return row!
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
  }
}
