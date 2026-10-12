import { createServerFn } from "@tanstack/react-start"
import {
  getRequestHeader,
  setResponseHeader,
} from "@tanstack/react-start/server"

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

    try {
      const res = await fetch(`${apiUrl}/users/me`, { headers: { cookie } })
      const setCookies = res.headers.getSetCookie()
      if (setCookies.length > 0) setResponseHeader("set-cookie", setCookies)
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
)
