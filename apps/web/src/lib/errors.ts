import type { ApiError, ApiErrorDetail } from "@workspace/shared/errors"

export class ApiRequestError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: Array<ApiErrorDetail>

  constructor(body: ApiError) {
    super(body.message)
    this.name = "ApiRequestError"
    this.statusCode = body.statusCode
    this.code = body.code
    this.details = body.details
  }
}

export function errorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof err.message === "string"
  ) {
    return err.message
  }
  return fallback
}
