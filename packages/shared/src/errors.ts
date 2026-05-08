import { z, type ZodIssue } from "zod"

export const ApiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
})

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  details: z.array(ApiErrorDetailSchema).optional(),
})

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  410: "GONE",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  501: "NOT_IMPLEMENTED",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
}

export function statusToCode(status: number): string {
  return STATUS_CODES[status] ?? `HTTP_${status}`
}

export function formatZodIssues(issues: ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }))
}

export function buildApiError(input: {
  statusCode: number
  message: string
  code?: string
  details?: ApiErrorDetail[]
}): ApiError {
  return {
    statusCode: input.statusCode,
    code: input.code ?? statusToCode(input.statusCode),
    message: input.message,
    ...(input.details !== undefined ? { details: input.details } : {}),
  }
}

export const VALIDATION_ERROR_CODE = "VALIDATION_ERROR"
export const VALIDATION_ERROR_MESSAGE = "Validation failed"

export function buildValidationError(issues: ZodIssue[]): ApiError {
  return buildApiError({
    statusCode: 400,
    code: VALIDATION_ERROR_CODE,
    message: VALIDATION_ERROR_MESSAGE,
    details: formatZodIssues(issues),
  })
}
