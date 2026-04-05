import { Inject, Injectable } from "@nestjs/common"
import { eq, and } from "drizzle-orm"
import { type DbClient, accounts } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { Account } from "../../domain/entities/account.entity"
import { AccountRepository } from "../../domain/repositories/account.repository"
import { AccountMapper } from "../mappers/account.mapper"

@Injectable()
export class AccountRepositoryImpl extends AccountRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {
    super()
  }

  async findAllByUserId(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
    return rows.map(AccountMapper.toDomain)
  }

  async findById(id: string, userId: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1)
    if (rows.length === 0) return null
    return AccountMapper.toDomain(rows[0])
  }

  async findByAccountId(id: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1)
    if (rows.length === 0) return null
    return AccountMapper.toDomain(rows[0])
  }

  async save(account: Account): Promise<Account> {
    if (account.id === "") {
      const rows = await this.db
        .insert(accounts)
        .values({
          userId: account.userId,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance.toString(),
        })
        .returning()
      return AccountMapper.toDomain(rows[0])
    }
    const rows = await this.db
      .update(accounts)
      .set({
        name: account.name,
        type: account.type,
        balance: account.balance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id))
      .returning()
    return AccountMapper.toDomain(rows[0])
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
  }
}
