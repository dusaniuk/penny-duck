import {
  Controller,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Throttle } from "@nestjs/throttler"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { Response } from "express"
import { isProduction } from "@workspace/env/api"
import { authContract } from "@workspace/api-contract"
import { LoginCommand } from "./commands/login.command"
import { LogoutCommand } from "./commands/logout.command"
import { RefreshTokensCommand } from "./commands/refresh-tokens.command"
import { SignupCommand } from "./commands/signup.command"
import { GenerateInviteCodeCommand } from "./commands/generate-invite-code.command"
import { GetInviteQuery } from "./queries/get-invite.query"
import { CookieService } from "./cookie.service"
import { JwtService } from "./jwt.service"
import type { AccessTokenPayload } from "./jwt.service"
import { AuthGuard } from "./auth.guard"
import { CurrentUser, CurrentOrg } from "./auth.decorator"

@Controller()
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService
  ) {}

  @TsRestHandler(authContract.signup)
  @Throttle({ default: { limit: isProduction ? 3 : 10_000, ttl: 60_000 } })
  handleSignup() {
    return tsRestHandler(authContract.signup, async ({ body }) => {
      const result = await this.commandBus.execute(
        new SignupCommand(body.name, body.email, body.password, body.inviteCode)
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

  @TsRestHandler(authContract.getInvite)
  handleGetInvite() {
    return tsRestHandler(authContract.getInvite, async ({ query }) => {
      const result = await this.queryBus.execute(
        new GetInviteQuery(query.code)
      )

      if (!result) {
        return {
          status: 404 as const,
          body: { message: "Invalid invite link" },
        }
      }

      return { status: 200 as const, body: result }
    })
  }

  @TsRestHandler(authContract.generateInviteCode)
  @UseGuards(AuthGuard)
  handleGenerateInviteCode(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentOrg() organizationId: string
  ) {
    return tsRestHandler(authContract.generateInviteCode, async () => {
      const result = await this.commandBus.execute(
        new GenerateInviteCodeCommand(user.sub, organizationId)
      )

      return { status: 200 as const, body: result }
    })
  }
}
