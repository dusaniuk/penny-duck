import { Injectable } from "@nestjs/common"
import * as svc from "@/hono/modules/accounts/service"

export type { AccountRow } from "@/hono/modules/accounts/service"

@Injectable()
export class AccountRepository {
  findAllByOrganizationId = svc.findAllByOrganizationId
  findById = svc.findById
}
