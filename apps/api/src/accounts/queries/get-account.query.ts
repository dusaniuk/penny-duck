import { NotFoundException } from "@nestjs/common"
import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"

export class GetAccountQuery extends Query<Account> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string
  ) {
    super()
  }
}

@QueryHandler(GetAccountQuery)
export class GetAccountHandler implements IQueryHandler<GetAccountQuery> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(query: GetAccountQuery): Promise<Account> {
    const row = await this.accountRepo.findById(query.id, query.organizationId)
    if (!row) throw new NotFoundException("Account not found")
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      balance: row.balance,
    }
  }
}
