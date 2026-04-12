import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { JwtModule } from "@nestjs/jwt"
import { env } from "@workspace/env/api"
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
import { JwtService } from "./jwt.service"
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
  imports: [
    DatabaseModule,
    CqrsModule,
    OrganizationsModule,
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: {
        expiresIn: env.JWT_EXPIRATION as import("ms").StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    UserRepository,
    RefreshTokenRepository,
    JwtService,
    CookieService,
    TokenCleanupService,
    AuthGuard,
  ],
  exports: [AuthGuard, JwtService],
})
export class AuthModule {}
