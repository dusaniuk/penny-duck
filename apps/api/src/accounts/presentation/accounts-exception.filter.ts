import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import {
  AccountNotFoundError,
  AccountHasTransactionsError,
} from "../errors/account.errors"

type AccountError = AccountNotFoundError | AccountHasTransactionsError

@Catch(AccountNotFoundError, AccountHasTransactionsError)
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
    if (exception instanceof AccountHasTransactionsError) {
      response
        .status(409)
        .json({ message: exception.message, count: exception.count })
      return
    }
  }
}
