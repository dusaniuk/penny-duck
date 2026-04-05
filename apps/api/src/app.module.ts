import { Module } from "@nestjs/common"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { AccountsModule } from "./accounts/accounts.module"
import { CategoriesModule } from "./categories/categories.module"
import { TransactionsModule } from "./transactions/transactions.module"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

@Module({
  imports: [
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
