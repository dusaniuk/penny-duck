import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ScheduleModule } from "@nestjs/schedule"
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { AccountsModule } from "./accounts/accounts.module"
import { CategoriesModule } from "./categories/categories.module"
import { TransactionsModule } from "./transactions/transactions.module"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
