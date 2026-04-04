import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import { AccountNotFoundError } from "../domain/errors/account.errors"

@Catch(AccountNotFoundError)
export class AccountsExceptionFilter implements ExceptionFilter {
  catch(exception: AccountNotFoundError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    response.status(404).json({ message: exception.message })
  }
}
