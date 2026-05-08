import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { getInvite } from "../core/auth"
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

  execute(query: GetInviteQuery): Promise<GetInviteResult | null> {
    return getInvite(query.code, {
      findOrgByInviteCode: (code) => this.orgRepo.findByInviteCode(code),
    })
  }
}
