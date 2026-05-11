import { QueryClient } from "@tanstack/react-query"
import { hc } from "hono/client"
import type { AppType } from "api/hono/app"

let refreshPromise: Promise<Response> | null = null

function refreshSession() {
  refreshPromise ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function fetchWithRefresh(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const merged: RequestInit = { ...init, credentials: "include" }
  const res = await fetch(input, merged)

  if (res.status === 401 && !url.includes("/auth/refresh")) {
    const refreshRes = await refreshSession()
    if (refreshRes.ok) return fetch(input, merged)
  }

  return res
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export const api = hc<AppType>("/api", { fetch: fetchWithRefresh })
