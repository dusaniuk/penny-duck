import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common"
import { Response } from "express"
import { isProduction } from "@workspace/env/api"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      response.status(status).json(
        typeof body === "string" ? { statusCode: status, message: body } : body
      )
      return
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : exception
    )

    response.status(500).json({
      statusCode: 500,
      message: "Internal server error",
      ...(isProduction
        ? {}
        : {
            error: exception instanceof Error ? exception.message : String(exception),
            stack: exception instanceof Error ? exception.stack : undefined,
          }),
    })
  }
}
