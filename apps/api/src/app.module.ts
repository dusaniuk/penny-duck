import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ScheduleModule } from "@nestjs/schedule"
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { isProduction } from "@workspace/env/api"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { AccountsModule } from "./accounts/accounts.module"
import { CategoriesModule } from "./categories/categories.module"
import { TransactionsModule } from "./transactions/transactions.module"
import { ExchangeRatesModule } from "./exchange-rates/exchange-rates.module"
import { UsersModule } from "./users/users.module"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

const throttleLimit = isProduction ? 100 : 10_000

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: throttleLimit }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    ExchangeRatesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
