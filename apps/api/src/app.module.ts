import { Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { AccountsModule } from "./accounts/accounts.module"
import { CategoriesModule } from "./categories/categories.module"
import { TransactionsModule } from "./transactions/transactions.module"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
