import { Account } from "../../domain/entities/account.entity"

interface AccountRow {
  id: string
  userId: string
  name: string
  type: string
  currency: string
  balance: string
  createdAt: Date
  updatedAt: Date
}

export class AccountMapper {
  static toDomain(row: AccountRow): Account {
    return Account.fromPersistence({
      id: row.id,
      userId: row.userId,
      name: row.name,
      type: row.type,
      currency: row.currency,
      balance: Number(row.balance),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
