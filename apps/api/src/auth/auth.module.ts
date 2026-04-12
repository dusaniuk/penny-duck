import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { JwtModule } from "@nestjs/jwt"
import { env } from "@workspace/env/api"
import { DatabaseModule } from "@/database/database.module"
import { OrganizationsModule } from "../organizations/organizations.module"

import { SignupHandler } from "./application/commands/signup.command"
import { LoginHandler } from "./application/commands/login.command"
import { RefreshTokensHandler } from "./application/commands/refresh-tokens.command"
import { LogoutHandler } from "./application/commands/logout.command"
import { TokenReuseDetectedHandler } from "./application/event-handlers/token-reuse-detected.handler"

import { UserRepository } from "./infrastructure/repositories/user.repository"
import { RefreshTokenRepository } from "./infrastructure/repositories/refresh-token.repository"
import { JwtService } from "./infrastructure/services/jwt.service"
import { CookieService } from "./infrastructure/services/cookie.service"
import { TokenCleanupService } from "./infrastructure/services/token-cleanup.service"

import { AuthController } from "./presentation/auth.controller"
import { AuthGuard } from "./presentation/auth.guard"
import { AuthExceptionFilter } from "./presentation/auth-exception.filter"

const commandHandlers = [
  SignupHandler,
  LoginHandler,
  RefreshTokensHandler,
  LogoutHandler,
]
const eventHandlers = [TokenReuseDetectedHandler]

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
    ...eventHandlers,
    UserRepository,
    RefreshTokenRepository,
    JwtService,
    CookieService,
    TokenCleanupService,
    AuthGuard,
    AuthExceptionFilter,
  ],
  exports: [AuthGuard, JwtService],
})
export class AuthModule {}
