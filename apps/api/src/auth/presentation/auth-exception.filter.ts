import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import {
  InvalidCredentialsError,
  InvalidTokenError,
  TokenExpiredError,
  TokenReuseDetectedError,
} from "../domain/errors/auth.errors"
import { CookieService } from "../infrastructure/services/cookie.service"

type AuthError =
  | InvalidCredentialsError
  | TokenReuseDetectedError
  | TokenExpiredError
  | InvalidTokenError

@Catch(
  InvalidCredentialsError,
  TokenReuseDetectedError,
  TokenExpiredError,
  InvalidTokenError
)
export class AuthExceptionFilter implements ExceptionFilter<AuthError> {
  constructor(private readonly cookieService: CookieService) {}

  catch(exception: AuthError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof TokenReuseDetectedError) {
      this.cookieService.clearTokens(response)
      response.status(401).json({ message: exception.message })
      return
    }

    response.status(401).json({ message: exception.message })
  }
}
