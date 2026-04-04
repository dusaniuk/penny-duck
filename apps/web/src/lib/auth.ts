import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { api } from "./api"

export interface AuthUser {
  id: string
  email: string
  name: string
}

export const getAuthUser = createServerFn().handler(
  async (): Promise<AuthUser | null> => {
    const SSR_API_URL = process.env.VITE_API_URL ?? "http://localhost:3030"

    try {
      const accessToken = getCookie("access_token")
      if (!accessToken) return null

      const res = await fetch(`${SSR_API_URL}/auth/me`, {
        headers: { Cookie: `access_token=${accessToken}` },
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
)
