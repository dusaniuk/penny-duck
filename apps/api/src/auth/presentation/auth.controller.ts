import {
  Controller,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { Response } from "express"
import { authContract } from "@workspace/api-contract"
import { LoginCommand } from "../application/commands/login.command"
import { LogoutCommand } from "../application/commands/logout.command"
import { RefreshTokensCommand } from "../application/commands/refresh-tokens.command"
import { SignupCommand } from "../application/commands/signup.command"
import { GetCurrentUserQuery } from "../application/queries/get-current-user.query"
import { CookieService } from "../infrastructure/services/cookie.service"
import {
  JwtService,
  type AccessTokenPayload,
} from "../infrastructure/services/jwt.service"
import { AuthExceptionFilter } from "./auth-exception.filter"
import { AuthGuard } from "./auth.guard"
import { CurrentUser } from "./auth.decorator"

@Controller()
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService
  ) {}

  @TsRestHandler(authContract.signup)
  handleSignup(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(authContract.signup, async ({ body }) => {
      const result = await this.commandBus.execute(
        new SignupCommand(body.name, body.email, body.password)
      )

      const accessJwt = this.jwtService.sign(result.accessToken)
      this.cookieService.setAccessToken(res, accessJwt)
      this.cookieService.setRefreshToken(res, result.refreshToken)

      return {
        status: 201 as const,
        body: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
      }
    })
  }

  @TsRestHandler(authContract.login)
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

  @TsRestHandler(authContract.me)
  @UseGuards(AuthGuard)
  handleMe(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(authContract.me, async () => {
      return {
        status: 200 as const,
        body: await this.queryBus.execute(
          new GetCurrentUserQuery(user.sub, user.email)
        ),
      }
    })
  }
}
