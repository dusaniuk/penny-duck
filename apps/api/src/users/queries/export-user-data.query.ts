import { NotFoundException } from "@nestjs/common"
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { UserRepository } from "../user.repository"

export class ExportUserDataQuery {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string
  ) {}
}

@QueryHandler(ExportUserDataQuery)
export class ExportUserDataHandler
  implements IQueryHandler<ExportUserDataQuery>
{
  constructor(private readonly userRepo: UserRepository) {}

  async execute(query: ExportUserDataQuery) {
    const data = await this.userRepo.getExportData(
      query.userId,
      query.organizationId
    )

    if (!data.user) {
      throw new NotFoundException("User not found")
    }

    return {
      exportedAt: new Date().toISOString(),
      user: data.user,
      organization: data.organization,
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
    }
  }
}
