import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { ExchangeRatesModule } from "@/exchange-rates/exchange-rates.module"
import { UserRepository } from "@/users/user.repository"
import { StatsRepository } from "./stats.repository"
import { GetMonthlySummaryHandler } from "./queries/get-monthly-summary.query"
import { StatsController } from "./stats.controller"

const queryHandlers = [GetMonthlySummaryHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule, ExchangeRatesModule],
  controllers: [StatsController],
  providers: [...queryHandlers, StatsRepository, UserRepository],
})
export class StatsModule {}
