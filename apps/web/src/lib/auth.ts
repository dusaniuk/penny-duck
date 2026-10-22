import { createServerFn } from "@tanstack/react-start"
import {
  getRequestHeader,
  setResponseHeader,
} from "@tanstack/react-start/server"
import { getApiAuthHeaders } from "@/server/api-auth"
import { logger } from "@/server/logger"

export interface AuthUser {
  id: string
  email: string
  name: string
  homeCurrency: string
}

export const getAuthUser = createServerFn().handler(
  async (): Promise<AuthUser | null> => {
    const apiUrl = process.env.API_URL ?? "http://localhost:3030"
    const cookie = getRequestHeader("cookie")
    if (!cookie) return null
    const requestId = getRequestHeader("x-request-id")

    try {
      const res = await fetch(`${apiUrl}/users/me`, {
        headers: {
          cookie,
          ...(requestId && { "x-request-id": requestId }),
          ...(await getApiAuthHeaders()),
        },
      })
      const setCookies = res.headers.getSetCookie()
      if (setCookies.length > 0) setResponseHeader("set-cookie", setCookies)
      if (res.status === 401) return null
      if (!res.ok) {
        logger.error("auth check failed", {
          requestId,
          status: res.status,
          apiUrl,
        })
        return null
      }
      return res.json()
    } catch (err) {
      logger.error("auth check failed", { requestId, apiUrl, err })
      return null
    }
  }
)
