import { Inject, Injectable } from "@nestjs/common"
import { eq, and, asc, sql, sum } from "drizzle-orm"
import {
  type DbClient,
  accounts,
  trades,
  transactions,
  organizationMembers,
} from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type AccountRow = typeof accounts.$inferSelect & {
  balance: number
  isDefault: boolean
}

@Injectable()
export class AccountRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  private balanceSubquery() {
    return this.db
      .select({
        accountId: transactions.accountId,
        total: sum(transactions.amount).as("tx_total"),
      })
      .from(transactions)
      .groupBy(transactions.accountId)
      .as("balance_sq")
  }

  // Trades hold their own cash impact directly: buy = -amount, sell = +amount,
  // dividend = +amount + withheld_tax (both stored in cents). Brokerage cash
  // sleeve = transactions sum (deposits) + this.
  private tradesCashSubquery() {
    return this.db
      .select({
        accountId: trades.accountId,
        total: sql<string>`sum(case
          when ${trades.type} = 'buy' then -${trades.amount}
          when ${trades.type} = 'sell' then ${trades.amount}
          when ${trades.type} = 'dividend' then ${trades.amount} + coalesce(${trades.withheldTax}, 0)
          else 0
        end)`.as("trades_total"),
      })
      .from(trades)
      .groupBy(trades.accountId)
      .as("trades_cash_sq")
  }

  async findAllByOrganizationId(
    organizationId: string,
    userId: string
  ): Promise<AccountRow[]> {
    const balanceSubquery = this.balanceSubquery()
    const tradesCashSubquery = this.tradesCashSubquery()
    return this.db
      .select({
        id: accounts.id,
        organizationId: accounts.organizationId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        initialBalance: accounts.initialBalance,
        externalAccountId: accounts.externalAccountId,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        balance: sql<number>`(${accounts.initialBalance} + coalesce(${balanceSubquery.total}, 0) + coalesce(${tradesCashSubquery.total}, 0))::float / 100`,
        isDefault: sql<boolean>`coalesce(${organizationMembers.defaultAccountId} = ${accounts.id}, false)`,
      })
      .from(accounts)
      .leftJoin(balanceSubquery, eq(balanceSubquery.accountId, accounts.id))
      .leftJoin(tradesCashSubquery, eq(tradesCashSubquery.accountId, accounts.id))
      .leftJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, accounts.organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .where(eq(accounts.organizationId, organizationId))
      .orderBy(asc(accounts.name))
  }

  async findById(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<AccountRow | null> {
    const balanceSubquery = this.balanceSubquery()
    const tradesCashSubquery = this.tradesCashSubquery()
    const rows = await this.db
      .select({
        id: accounts.id,
        organizationId: accounts.organizationId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        initialBalance: accounts.initialBalance,
        externalAccountId: accounts.externalAccountId,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        balance: sql<number>`(${accounts.initialBalance} + coalesce(${balanceSubquery.total}, 0) + coalesce(${tradesCashSubquery.total}, 0))::float / 100`,
        isDefault: sql<boolean>`coalesce(${organizationMembers.defaultAccountId} = ${accounts.id}, false)`,
      })
      .from(accounts)
      .leftJoin(balanceSubquery, eq(balanceSubquery.accountId, accounts.id))
      .leftJoin(tradesCashSubquery, eq(tradesCashSubquery.accountId, accounts.id))
      .leftJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, accounts.organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
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
    return { ...row, balance: row.initialBalance, isDefault: false }
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    data: { name?: string; type?: string }
  ): Promise<AccountRow> {
    await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)))
    const row = await this.findById(id, organizationId, userId)
    return row!
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.organizationId, organizationId)))
  }

  async setDefault(
    userId: string,
    organizationId: string,
    accountId: string
  ): Promise<void> {
    await this.db
      .update(organizationMembers)
      .set({ defaultAccountId: accountId })
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
  }

  async clearDefault(userId: string, organizationId: string): Promise<void> {
    await this.db
      .update(organizationMembers)
      .set({ defaultAccountId: null })
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
  }
}
