import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { OrganizationRepository } from "../../organizations/organization.repository"

export class GetInviteQuery {
  constructor(public readonly code: string) {}
}

export interface GetInviteResult {
  organizationName: string
}

@QueryHandler(GetInviteQuery)
export class GetInviteHandler implements IQueryHandler<GetInviteQuery> {
  constructor(private readonly orgRepo: OrganizationRepository) {}

  async execute(query: GetInviteQuery): Promise<GetInviteResult | null> {
    const org = await this.orgRepo.findByInviteCode(query.code)
    if (!org) return null
    return { organizationName: org.name }
  }
}
