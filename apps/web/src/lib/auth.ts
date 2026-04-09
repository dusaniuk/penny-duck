import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"

export interface AuthUser {
  id: string
  email: string
  name: string
}

async function refreshTokens(apiUrl: string): Promise<string | undefined> {
  const refreshToken = getCookie("refresh_token")
  if (!refreshToken) return undefined

  const res = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `refresh_token=${refreshToken}` },
  })
  if (!res.ok) return undefined

  const setCookieHeaders = res.headers.getSetCookie()
  let newAccessToken: string | undefined

  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(";")
    const eqIndex = nameValue.indexOf("=")
    const name = nameValue.slice(0, eqIndex)
    const value = nameValue.slice(eqIndex + 1)

    if (name === "access_token") {
      newAccessToken = value
      setCookie(name, value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      })
    } else if (name === "refresh_token") {
      setCookie(name, value, {
        httpOnly: true,
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
      process.env.API_URL ??
      process.env.VITE_API_URL ??
      "http://localhost:3030"

    try {
      let accessToken = getCookie("access_token")

      if (!accessToken) {
        accessToken = await refreshTokens(SSR_API_URL)
        if (!accessToken) return null
      }

      const res = await fetch(`${SSR_API_URL}/auth/me`, {
        headers: { Cookie: `access_token=${accessToken}` },
      })

      if (res.status === 401) {
        accessToken = await refreshTokens(SSR_API_URL)
        if (!accessToken) return null

        const retryRes = await fetch(`${SSR_API_URL}/auth/me`, {
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
