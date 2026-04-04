import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { Account } from "../domain/entities/account.entity"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"

export class GetAccountQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@QueryHandler(GetAccountQuery)
export class GetAccountHandler implements IQueryHandler<GetAccountQuery> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(query: GetAccountQuery): Promise<Account> {
    const account = await this.accountRepo.findById(query.id, query.userId)
    if (!account) throw new AccountNotFoundError()
    return account
  }
}
