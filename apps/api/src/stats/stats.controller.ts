import { Controller, UseGuards } from "@nestjs/common"
import { QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { statsContract } from "@workspace/api-contract"
import { AuthGuard } from "@/auth/auth.guard"
import { CurrentOrg, CurrentUser } from "@/auth/auth.decorator"
import type { AccessTokenPayload } from "@/auth/jwt.service"
import { UserRepository } from "@/users/user.repository"
import { GetMonthlySummaryQuery } from "./queries/get-monthly-summary.query"

@Controller()
@UseGuards(AuthGuard)
export class StatsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly userRepo: UserRepository,
  ) {}

  @TsRestHandler(statsContract.monthlySummary)
  handleMonthlySummary(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(statsContract.monthlySummary, async ({ query }) => {
      const userRow = await this.userRepo.findById(user.sub)
      const homeCurrency = userRow?.homeCurrency ?? "UAH"
      const months = query.months ?? 6

      const summary = await this.queryBus.execute(
        new GetMonthlySummaryQuery(organizationId, homeCurrency, months),
      )
      return { status: 200 as const, body: summary }
    })
  }
}
