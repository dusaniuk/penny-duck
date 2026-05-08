import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common"
import { Response } from "express"
import {
  buildApiError,
  buildValidationError,
  type ApiError,
} from "@workspace/shared/errors"
import type { ZodIssue } from "zod"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      response.status(status).json(this.toApiError(status, body))
      return
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : exception,
    )

    response
      .status(500)
      .json(buildApiError({ statusCode: 500, message: "Internal server error" }))
  }

  private toApiError(status: number, body: string | object): ApiError {
    if (typeof body === "string") {
      return buildApiError({ statusCode: status, message: body })
    }

    if (this.isApiError(body)) {
      return body
    }

    const issues = this.extractZodIssues(body)
    if (issues) {
      return buildValidationError(issues)
    }

    const record = body as Record<string, unknown>
    const message = typeof record.message === "string" ? record.message : ""
    return buildApiError({ statusCode: status, message })
  }

  private isApiError(body: unknown): body is ApiError {
    if (typeof body !== "object" || body === null) return false
    const record = body as Record<string, unknown>
    return (
      typeof record.statusCode === "number" &&
      typeof record.code === "string" &&
      typeof record.message === "string"
    )
  }

  private extractZodIssues(body: unknown): ZodIssue[] | null {
    if (typeof body !== "object" || body === null) return null
    const record = body as Record<string, unknown>

    if (this.isZodErrorPayload(record)) {
      return record.issues as ZodIssue[]
    }

    const sources = ["bodyResult", "queryResult", "paramsResult", "headersResult"] as const
    const collected: ZodIssue[] = []
    let matched = false
    for (const key of sources) {
      const value = record[key]
      if (this.isZodErrorPayload(value)) {
        matched = true
        collected.push(...((value as { issues: ZodIssue[] }).issues))
      }
    }
    return matched ? collected : null
  }

  private isZodErrorPayload(value: unknown): value is { name: string; issues: ZodIssue[] } {
    if (typeof value !== "object" || value === null) return false
    const record = value as Record<string, unknown>
    return record.name === "ZodError" && Array.isArray(record.issues)
  }
}
