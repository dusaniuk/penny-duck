import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { ExchangeRatesModule } from "@/exchange-rates/exchange-rates.module"
import { UserRepository } from "@/users/user.repository"
import { InvestmentsController } from "./investments.controller"
import { YahooFinanceClient } from "./yahoo-finance.client"
import { InstrumentRepository } from "./instrument.repository"
import { TradeRepository } from "./trade.repository"
import { InstrumentService } from "./instrument.service"
import { SearchInstrumentsHandler } from "./queries/search-instruments.query"
import { GetInstrumentHandler } from "./queries/get-instrument.query"
import { GetPositionsHandler } from "./queries/get-positions.query"
import { GetPositionBySymbolHandler } from "./queries/get-position-by-symbol.query"
import { GetTradesHandler } from "./queries/get-trades.query"
import { GetInvestmentsSummaryHandler } from "./queries/get-summary.query"
import { CreateTradeHandler } from "./commands/create-trade.command"
import { UpdateTradeHandler } from "./commands/update-trade.command"
import { DeleteTradeHandler } from "./commands/delete-trade.command"
import { RefreshPricesHandler } from "./commands/refresh-prices.command"
import { ImportTradesHandler } from "./commands/import-trades.command"

const commandHandlers = [
  CreateTradeHandler,
  UpdateTradeHandler,
  DeleteTradeHandler,
  RefreshPricesHandler,
  ImportTradesHandler,
]
const queryHandlers = [
  SearchInstrumentsHandler,
  GetInstrumentHandler,
  GetPositionsHandler,
  GetPositionBySymbolHandler,
  GetTradesHandler,
  GetInvestmentsSummaryHandler,
]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule, ExchangeRatesModule],
  controllers: [InvestmentsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    YahooFinanceClient,
    InstrumentRepository,
    TradeRepository,
    InstrumentService,
    UserRepository,
  ],
  exports: [InstrumentRepository, TradeRepository],
})
export class InvestmentsModule {}
