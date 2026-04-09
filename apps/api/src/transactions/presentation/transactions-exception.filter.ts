import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common"
import { Response } from "express"
import {
  InvalidSettlementError,
  InvalidTransferError,
  TransactionNotFoundError,
  TransferOperationError,
} from "../errors/transaction.errors"

type TransactionError =
  | TransactionNotFoundError
  | InvalidTransferError
  | InvalidSettlementError
  | TransferOperationError

@Catch(
  TransactionNotFoundError,
  InvalidTransferError,
  InvalidSettlementError,
  TransferOperationError
)
export class TransactionsExceptionFilter
  implements ExceptionFilter<TransactionError>
{
  catch(exception: TransactionError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof TransactionNotFoundError) {
      response.status(404).json({ message: exception.message })
      return
    }
    response.status(400).json({ message: exception.message })
  }
}
