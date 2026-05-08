import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { OrganizationsModule } from "../organizations/organizations.module"

import { SignupHandler } from "./commands/signup.command"
import { LoginHandler } from "./commands/login.command"
import { RefreshTokensHandler } from "./commands/refresh-tokens.command"
import { LogoutHandler } from "./commands/logout.command"
import { GenerateInviteCodeHandler } from "./commands/generate-invite-code.command"
import { GetInviteHandler } from "./queries/get-invite.query"

import { UserRepository } from "./user.repository"
import { RefreshTokenRepository } from "./refresh-token.repository"
import { CookieService } from "./cookie.service"
import { TokenCleanupService } from "./token-cleanup.service"

import { AuthController } from "./auth.controller"
import { AuthGuard } from "./auth.guard"

const commandHandlers = [
  SignupHandler,
  LoginHandler,
  RefreshTokensHandler,
  LogoutHandler,
  GenerateInviteCodeHandler,
]
const queryHandlers = [GetInviteHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, OrganizationsModule],
  controllers: [AuthController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    UserRepository,
    RefreshTokenRepository,
    CookieService,
    TokenCleanupService,
    AuthGuard,
  ],
  exports: [AuthGuard, CookieService],
})
export class AuthModule {}
