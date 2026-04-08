import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import {
  AccountNotFoundError,
  InvalidDeleteModeError,
} from "../domain/errors/account.errors"

type AccountError = AccountNotFoundError | InvalidDeleteModeError

@Catch(AccountNotFoundError, InvalidDeleteModeError)
export class AccountsExceptionFilter
  implements ExceptionFilter<AccountError>
{
  catch(exception: AccountError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof AccountNotFoundError) {
      response.status(404).json({ message: exception.message })
      return
    }
    response.status(400).json({ message: exception.message })
  }
}
