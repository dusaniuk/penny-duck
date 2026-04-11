import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"

export class GetAccountsQuery extends Query<Account[]> {
  constructor(public readonly organizationId: string) {
    super()
  }
}

@QueryHandler(GetAccountsQuery)
export class GetAccountsHandler implements IQueryHandler<GetAccountsQuery> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(query: GetAccountsQuery): Promise<Account[]> {
    const rows = await this.accountRepo.findAllByOrganizationId(query.organizationId)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      currency: r.currency,
      balance: r.balance,
    }))
  }
}
