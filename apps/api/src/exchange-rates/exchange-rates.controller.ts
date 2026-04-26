import { Controller, UseGuards } from "@nestjs/common"
import { QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { exchangeRateContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentOrg, CurrentUser } from "../auth/auth.decorator"
import type { AccessTokenPayload } from "../auth/jwt.service"
import { GetLatestRatesQuery } from "./queries/get-latest-rates.query"

@Controller()
@UseGuards(AuthGuard)
export class ExchangeRatesController {
  constructor(private readonly queryBus: QueryBus) {}

  @TsRestHandler(exchangeRateContract.latest)
  handleLatest(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(exchangeRateContract.latest, async () => {
      const result = await this.queryBus.execute(
        new GetLatestRatesQuery(organizationId, user.sub),
      )
      return { status: 200 as const, body: result }
    })
  }
}
