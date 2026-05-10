import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { getAccount } from "@/hono/modules/accounts/service"

export class GetAccountQuery extends Query<Account> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string,
  ) {
    super()
  }
}

@QueryHandler(GetAccountQuery)
export class GetAccountHandler implements IQueryHandler<GetAccountQuery> {
  async execute(query: GetAccountQuery): Promise<Account> {
    return getAccount(query.id, query.organizationId, query.userId)
  }
}
