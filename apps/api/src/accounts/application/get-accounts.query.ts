import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { Account } from "../domain/entities/account.entity"
import { AccountRepository } from "../repositories/account.repository"

export class GetAccountsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetAccountsQuery)
export class GetAccountsHandler implements IQueryHandler<GetAccountsQuery> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(query: GetAccountsQuery): Promise<Account[]> {
    return this.accountRepo.findAllByUserId(query.userId)
  }
}
