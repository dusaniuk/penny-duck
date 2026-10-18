import { QueryClient } from "@tanstack/react-query"
import { hc } from "hono/client"
import { ApiErrorSchema, statusToCode } from "@workspace/shared/errors"
import { ApiRequestError } from "./errors"
import type { ApiError } from "@workspace/shared/errors"
import type { AppType } from "api/app"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export const api = hc<AppType>("/api", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
})

interface JsonResponse {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}

type JsonBody<TResponse> = TResponse extends { json: () => Promise<infer B> }
  ? B
  : never
type SuccessBody<TResponse> = JsonBody<Exclude<TResponse, { ok: false }>>

// Resolves to the success body; a non-2xx response throws ApiRequestError
// built from the API's error body (or from the status when it isn't JSON).
export async function unwrap<TResponse extends JsonResponse>(
  request: Promise<TResponse>
): Promise<SuccessBody<TResponse>> {
  const res = await request
  if (res.ok) return (await res.json()) as SuccessBody<TResponse>
  const body: unknown = await res.json().catch(() => undefined)
  throw new ApiRequestError(
    isApiError(body)
      ? body
      : {
          statusCode: res.status,
          code: statusToCode(res.status),
          message: res.statusText || `Request failed (${res.status})`,
        }
  )
}

function isApiError(body: unknown): body is ApiError {
  return ApiErrorSchema.safeParse(body).success
}
