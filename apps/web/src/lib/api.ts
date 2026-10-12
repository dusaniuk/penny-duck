import { QueryClient } from "@tanstack/react-query"
import { hc } from "hono/client"
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
