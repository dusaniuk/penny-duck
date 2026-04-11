import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { AccountRepository } from "@/accounts/account.repository"
import { ExchangeRateClient } from "./exchange-rate.client"
import { ExchangeRateRepository } from "./exchange-rate.repository"
import { ExchangeRateService } from "./exchange-rate.service"
import { GetLatestRatesHandler } from "./queries/get-latest-rates.query"
import { ExchangeRatesController } from "./exchange-rates.controller"

const queryHandlers = [GetLatestRatesHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule],
  controllers: [ExchangeRatesController],
  providers: [
    ...queryHandlers,
    ExchangeRateClient,
    ExchangeRateRepository,
    ExchangeRateService,
    AccountRepository,
  ],
  exports: [ExchangeRateService],
})
export class ExchangeRatesModule {}
