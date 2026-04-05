import { Account } from "../entities/account.entity"

export abstract class AccountRepository {
  abstract findAllByUserId(userId: string): Promise<Account[]>
  abstract findById(id: string, userId: string): Promise<Account | null>
  abstract findByAccountId(id: string): Promise<Account | null>
  abstract save(account: Account): Promise<Account>
  abstract delete(id: string, userId: string): Promise<void>
}
