import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import { parse as parseSetCookie } from "set-cookie-parser"

export interface AuthUser {
  id: string
  email: string
  name: string
  homeCurrency: string
}

async function refreshTokens(apiUrl: string): Promise<string | undefined> {
  const refreshToken = getCookie("refresh_token")
  if (!refreshToken) return undefined

  const res = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `refresh_token=${refreshToken}` },
  })
  if (!res.ok) return undefined

  const cookies = parseSetCookie(res.headers.getSetCookie())
  let newAccessToken: string | undefined

  for (const cookie of cookies) {
    if (cookie.name === "access_token") {
      newAccessToken = cookie.value
      setCookie(cookie.name, cookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      })
    } else if (cookie.name === "refresh_token") {
      setCookie(cookie.name, cookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      })
    }
  }

  return newAccessToken
}

export const getAuthUser = createServerFn().handler(
  async (): Promise<AuthUser | null> => {
    const SSR_API_URL =
      process.env.API_URL ?? "http://localhost:3030"

    try {
      let accessToken = getCookie("access_token")
      let didRefresh = false

      if (!accessToken) {
        accessToken = await refreshTokens(SSR_API_URL)
        if (!accessToken) return null
        didRefresh = true
      }

      const res = await fetch(`${SSR_API_URL}/users/me`, {
        headers: { Cookie: `access_token=${accessToken}` },
      })

      if (res.status === 401) {
        // If we just refreshed and still got 401, don't retry — avoids
        // sending the same (now-rotated) refresh token cookie again
        if (didRefresh) return null

        accessToken = await refreshTokens(SSR_API_URL)
        if (!accessToken) return null

        const retryRes = await fetch(`${SSR_API_URL}/users/me`, {
          headers: { Cookie: `access_token=${accessToken}` },
        })
        if (!retryRes.ok) return null
        return retryRes.json()
      }

      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
)
