import { initTsrReactQuery } from "@ts-rest/react-query/v5"
import { tsRestFetchApi } from "@ts-rest/core"
import { QueryClient } from "@tanstack/react-query"
import { contract } from "@workspace/api-contract"
import type { ApiFetcherArgs } from "@ts-rest/core"

let refreshPromise: Promise<Response> | null = null

async function fetchWithRefresh(args: ApiFetcherArgs) {
  const res = await tsRestFetchApi(args)

  if (res.status === 401 && !args.path.includes("/auth/refresh")) {
    if (!refreshPromise) {
      refreshPromise = fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        refreshPromise = null
      })
    }

    const refreshRes = await refreshPromise

    if (refreshRes.ok) {
      return tsRestFetchApi(args)
    }
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

export const tsr = initTsrReactQuery(contract, {
  baseUrl: "/api",
  credentials: "include",
  baseHeaders: { "Content-Type": "application/json" },
  api: fetchWithRefresh,
})
