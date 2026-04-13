import { Inject, Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import {
  type DbClient,
  users,
  organizations,
  accounts,
  categories,
  transactions,
} from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

type UserRow = typeof users.$inferSelect

@Injectable()
export class UserRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  async updateProfile(
    userId: string,
    data: { name?: string; homeCurrency?: string }
  ): Promise<UserRow | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.homeCurrency !== undefined) updates.homeCurrency = data.homeCurrency

    const rows = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning()

    return rows[0] ?? null
  }

  async delete(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId))
  }

  async getExportData(userId: string, organizationId: string) {
    const [user, org, accts, cats, txns] = await Promise.all([
      this.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          homeCurrency: users.homeCurrency,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      this.db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1),
      this.db
        .select({
          id: accounts.id,
          name: accounts.name,
          type: accounts.type,
          currency: accounts.currency,
          initialBalance: accounts.initialBalance,
          createdAt: accounts.createdAt,
        })
        .from(accounts)
        .where(eq(accounts.organizationId, organizationId)),
      this.db
        .select({
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          parentId: categories.parentId,
          createdAt: categories.createdAt,
        })
        .from(categories)
        .where(eq(categories.organizationId, organizationId)),
      this.db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          note: transactions.note,
          date: transactions.date,
          settled: transactions.settled,
          accountId: transactions.accountId,
          categoryId: transactions.categoryId,
          originalAmount: transactions.originalAmount,
          originalCurrency: transactions.originalCurrency,
          exchangeRate: transactions.exchangeRate,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.organizationId, organizationId)),
    ])

    return {
      user: user[0] ?? null,
      organization: org[0] ?? null,
      accounts: accts,
      categories: cats,
      transactions: txns,
    }
  }
}
