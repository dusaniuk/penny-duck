import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Response } from "express"
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
import { LoginDto } from "./dto/login.dto"
import { SignupDto } from "./dto/signup.dto"

@Controller("auth")
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService
  ) {}

  @Post("signup")
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.commandBus.execute(
      new SignupCommand(dto.name, dto.email, dto.password)
    )

    const accessJwt = this.jwtService.sign(result.accessToken)
    this.cookieService.setAccessToken(res, accessJwt)
    this.cookieService.setRefreshToken(res, result.refreshToken)

    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    }
  }

  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.commandBus.execute(
      new LoginCommand(dto.email, dto.password)
    )

    const accessJwt = this.jwtService.sign(result.accessToken)
    this.cookieService.setAccessToken(res, accessJwt)
    this.cookieService.setRefreshToken(res, result.refreshToken)

    return result.user
  }

  @Post("refresh")
  async refresh(@Res({ passthrough: true }) res: Response) {
    const rawToken = res.req.cookies?.refresh_token
    if (!rawToken) {
      this.cookieService.clearTokens(res)
      return res.status(401).json({ message: "No refresh token" })
    }

    const result = await this.commandBus.execute(
      new RefreshTokensCommand(rawToken)
    )

    const accessJwt = this.jwtService.sign(result.accessToken)
    this.cookieService.setAccessToken(res, accessJwt)
    this.cookieService.setRefreshToken(res, result.refreshToken)

    return { message: "Tokens refreshed" }
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    const rawToken = res.req.cookies?.refresh_token
    this.cookieService.clearTokens(res)

    if (rawToken) {
      // Fire and forget — don't block the response
      this.commandBus.execute(new LogoutCommand(rawToken)).catch(() => {})
    }

    return { message: "Logged out" }
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload) {
    return this.queryBus.execute(new GetCurrentUserQuery(user.sub, user.email))
  }
}
