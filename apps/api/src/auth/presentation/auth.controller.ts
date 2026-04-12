import {
  Controller,
  Res,
  UnauthorizedException,
  UseFilters,
} from "@nestjs/common"
import { CommandBus } from "@nestjs/cqrs"
import { Throttle } from "@nestjs/throttler"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { Response } from "express"
import { isProduction } from "@workspace/env/api"
import { authContract } from "@workspace/api-contract"
import { LoginCommand } from "../application/commands/login.command"
import { LogoutCommand } from "../application/commands/logout.command"
import { RefreshTokensCommand } from "../application/commands/refresh-tokens.command"
import { SignupCommand } from "../application/commands/signup.command"
import { CookieService } from "../infrastructure/services/cookie.service"
import { JwtService } from "../infrastructure/services/jwt.service"
import { AuthExceptionFilter } from "./auth-exception.filter"

@Controller()
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService
  ) {}

  @TsRestHandler(authContract.signup)
  @Throttle({ default: { limit: isProduction ? 3 : 10_000, ttl: 60_000 } })
  handleSignup() {
    return tsRestHandler(authContract.signup, async ({ body }) => {
      const result = await this.commandBus.execute(
        new SignupCommand(body.name, body.email, body.password)
      )

      return {
        status: 201 as const,
        body: { message: result.message },
      }
    })
  }

  @TsRestHandler(authContract.login)
  @Throttle({ default: { limit: isProduction ? 5 : 10_000, ttl: 60_000 } })
  handleLogin(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(authContract.login, async ({ body }) => {
      const result = await this.commandBus.execute(
        new LoginCommand(body.email, body.password)
      )

      const accessJwt = this.jwtService.sign(result.accessToken)
      this.cookieService.setAccessToken(res, accessJwt)
      this.cookieService.setRefreshToken(res, result.refreshToken)

      return { status: 200 as const, body: result.user }
    })
  }

  @TsRestHandler(authContract.refresh)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  handleRefresh(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(authContract.refresh, async () => {
      const rawToken = res.req.cookies?.refresh_token
      if (!rawToken) {
        this.cookieService.clearTokens(res)
        throw new UnauthorizedException("No refresh token")
      }

      const result = await this.commandBus.execute(
        new RefreshTokensCommand(rawToken)
      )

      const accessJwt = this.jwtService.sign(result.accessToken)
      this.cookieService.setAccessToken(res, accessJwt)
      this.cookieService.setRefreshToken(res, result.refreshToken)

      return { status: 200 as const, body: { message: "Tokens refreshed" } }
    })
  }

  @TsRestHandler(authContract.logout)
  handleLogout(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(authContract.logout, async () => {
      const rawToken = res.req.cookies?.refresh_token
      this.cookieService.clearTokens(res)

      if (rawToken) {
        this.commandBus.execute(new LogoutCommand(rawToken)).catch(() => {})
      }

      return { status: 200 as const, body: { message: "Logged out" } }
    })
  }

}
