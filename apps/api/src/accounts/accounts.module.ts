import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { CreateAccountHandler } from "./commands/create-account.command"
import { GetAccountHandler } from "./queries/get-account.query"
import { AccountRepository } from "./account.repository"

@Module({
  imports: [CqrsModule],
  providers: [CreateAccountHandler, GetAccountHandler, AccountRepository],
  exports: [AccountRepository],
})
export class AccountsModule {}
