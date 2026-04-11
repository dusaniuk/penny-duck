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

  async findAllByOrganizationId(organizationId: string): Promise<AccountRow[]> {
    const balanceSubquery = this.balanceSubquery()
    return this.db
      .select({
        id: accounts.id,
        organizationId: accounts.organizationId,
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
      .where(eq(accounts.organizationId, organizationId))
      .orderBy(asc(accounts.name))
  }

  async findById(id: string, organizationId: string): Promise<AccountRow | null> {
    const balanceSubquery = this.balanceSubquery()
    const rows = await this.db
      .select({
        id: accounts.id,
        organizationId: accounts.organizationId,
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
      .where(and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)))
      .limit(1)
    return rows[0] ?? null
  }

  async insert(data: {
    organizationId: string
    name: string
    type: string
    currency: string
    initialBalance?: number
  }): Promise<AccountRow> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        organizationId: data.organizationId,
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
    organizationId: string,
    data: { name?: string; type?: string }
  ): Promise<AccountRow> {
    await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)))
    const row = await this.findById(id, organizationId)
    return row!
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)))
  }
}
