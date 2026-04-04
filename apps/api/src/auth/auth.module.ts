import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { JwtModule } from "@nestjs/jwt"
import { env } from "@workspace/env/api"
import { DatabaseModule } from "@/database/database.module"

import { SignupHandler } from "./application/commands/signup.command"
import { LoginHandler } from "./application/commands/login.command"
import { RefreshTokensHandler } from "./application/commands/refresh-tokens.command"
import { LogoutHandler } from "./application/commands/logout.command"
import { GetCurrentUserHandler } from "./application/queries/get-current-user.query"
import { TokenReuseDetectedHandler } from "./application/event-handlers/token-reuse-detected.handler"

import { UserRepository } from "./domain/repositories/user.repository"
import { RefreshTokenRepository } from "./domain/repositories/refresh-token.repository"

import { UserRepositoryImpl } from "./infrastructure/repositories/user.repository"
import { RefreshTokenRepositoryImpl } from "./infrastructure/repositories/refresh-token.repository"
import { JwtService } from "./infrastructure/services/jwt.service"
import { CookieService } from "./infrastructure/services/cookie.service"

import { AuthController } from "./presentation/auth.controller"
import { AuthGuard } from "./presentation/auth.guard"
import { AuthExceptionFilter } from "./presentation/auth-exception.filter"

const commandHandlers = [
  SignupHandler,
  LoginHandler,
  RefreshTokensHandler,
  LogoutHandler,
]
const queryHandlers = [GetCurrentUserHandler]
const eventHandlers = [TokenReuseDetectedHandler]

@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
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
    ...eventHandlers,
    { provide: UserRepository, useClass: UserRepositoryImpl },
    { provide: RefreshTokenRepository, useClass: RefreshTokenRepositoryImpl },
    JwtService,
    CookieService,
    AuthGuard,
    AuthExceptionFilter,
  ],
  exports: [AuthGuard, JwtService],
})
export class AuthModule {}
