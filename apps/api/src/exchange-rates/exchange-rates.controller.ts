import { Controller, UseGuards } from "@nestjs/common"
import { QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { exchangeRateContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentOrg } from "../auth/auth.decorator"
import { GetLatestRatesQuery } from "./queries/get-latest-rates.query"

@Controller()
@UseGuards(AuthGuard)
export class ExchangeRatesController {
  constructor(private readonly queryBus: QueryBus) {}

  @TsRestHandler(exchangeRateContract.latest)
  handleLatest(@CurrentOrg() organizationId: string) {
    return tsRestHandler(exchangeRateContract.latest, async () => {
      const result = await this.queryBus.execute(
        new GetLatestRatesQuery(organizationId),
      )
      return { status: 200 as const, body: result }
    })
  }
}
