import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { FileInterceptor } from "@nestjs/platform-express"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import type { ImportTradesResponse } from "@workspace/api-contract"
import { investmentsContract } from "@workspace/api-contract"
import { AuthGuard } from "@/auth/auth.guard"
import { CurrentOrg, CurrentUser } from "@/auth/auth.decorator"
import type { AccessTokenPayload } from "@/auth/jwt.service"
import { SearchInstrumentsQuery } from "./queries/search-instruments.query"
import { GetInstrumentQuery } from "./queries/get-instrument.query"
import { GetPositionsQuery } from "./queries/get-positions.query"
import { GetPositionBySymbolQuery } from "./queries/get-position-by-symbol.query"
import { GetInvestmentsSummaryQuery } from "./queries/get-summary.query"
import { GetTradesQuery } from "./queries/get-trades.query"
import { CreateTradeCommand } from "./commands/create-trade.command"
import { UpdateTradeCommand } from "./commands/update-trade.command"
import { DeleteTradeCommand } from "./commands/delete-trade.command"
import { ImportTradesCommand } from "./commands/import-trades.command"
import { RefreshPricesCommand } from "./commands/refresh-prices.command"

@Controller()
@UseGuards(AuthGuard)
export class InvestmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(investmentsContract.searchInstruments)
  handleSearchInstruments() {
    return tsRestHandler(investmentsContract.searchInstruments, async ({ query }) => {
      const result = await this.queryBus.execute(new SearchInstrumentsQuery(query.q))
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.getInstrument)
  handleGetInstrument() {
    return tsRestHandler(investmentsContract.getInstrument, async ({ params }) => {
      const result = await this.queryBus.execute(new GetInstrumentQuery(params.symbol))
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.refreshPrices)
  handleRefreshPrices(@CurrentOrg() organizationId: string) {
    return tsRestHandler(investmentsContract.refreshPrices, async () => {
      const result = await this.commandBus.execute(new RefreshPricesCommand(organizationId))
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.listPositions)
  handleListPositions(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(investmentsContract.listPositions, async () => {
      const result = await this.queryBus.execute(
        new GetPositionsQuery(organizationId, user.sub)
      )
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.getPositionBySymbol)
  handleGetPositionBySymbol(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(investmentsContract.getPositionBySymbol, async ({ params }) => {
      const result = await this.queryBus.execute(
        new GetPositionBySymbolQuery(
          params.accountId,
          params.symbol,
          organizationId,
          user.sub
        )
      )
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.getSummary)
  handleGetSummary(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(investmentsContract.getSummary, async () => {
      const result = await this.queryBus.execute(
        new GetInvestmentsSummaryQuery(organizationId, user.sub)
      )
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.listTrades)
  handleListTrades(@CurrentOrg() organizationId: string) {
    return tsRestHandler(investmentsContract.listTrades, async ({ query }) => {
      const result = await this.queryBus.execute(
        new GetTradesQuery({
          organizationId,
          accountId: query.accountId,
          symbol: query.symbol,
          type: query.type,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
        })
      )
      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(investmentsContract.createTrade)
  handleCreateTrade(@CurrentOrg() organizationId: string) {
    return tsRestHandler(investmentsContract.createTrade, async ({ body }) => {
      const trade = await this.commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: body.accountId,
          symbol: body.symbol,
          type: body.type,
          quantity: body.quantity,
          price: body.price,
          amount: body.amount,
          fees: body.fees,
          date: new Date(body.date),
        })
      )
      return { status: 201 as const, body: trade }
    })
  }

  @TsRestHandler(investmentsContract.updateTrade)
  handleUpdateTrade(@CurrentOrg() organizationId: string) {
    return tsRestHandler(investmentsContract.updateTrade, async ({ params, body }) => {
      const trade = await this.commandBus.execute(
        new UpdateTradeCommand({
          id: params.id,
          organizationId,
          symbol: body.symbol,
          quantity: body.quantity,
          price: body.price,
          amount: body.amount,
          fees: body.fees,
          date: body.date ? new Date(body.date) : undefined,
        })
      )
      return { status: 200 as const, body: trade }
    })
  }

  @TsRestHandler(investmentsContract.deleteTrade)
  handleDeleteTrade(@CurrentOrg() organizationId: string) {
    return tsRestHandler(investmentsContract.deleteTrade, async ({ params }) => {
      await this.commandBus.execute(new DeleteTradeCommand(params.id, organizationId))
      return { status: 200 as const, body: { message: "Trade deleted" } }
    })
  }

  @Post("/trades/import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async handleImportTrades(
    @CurrentOrg() organizationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("accountId") accountId: string,
    @Body("dryRun") dryRunRaw: string
  ): Promise<ImportTradesResponse> {
    if (!file) throw new BadRequestException("file is required")
    if (!accountId) throw new BadRequestException("accountId is required")
    const dryRun = dryRunRaw === "true"
    return this.commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId,
        fileBuffer: file.buffer,
        dryRun,
      })
    )
  }
}
