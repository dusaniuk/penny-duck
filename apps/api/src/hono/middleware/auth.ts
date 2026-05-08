import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { env } from "@workspace/env/api"
import { ACCESS_TOKEN_COOKIE } from "@/auth/core/cookies"
import { verifyAccessToken, type AccessTokenPayload } from "@/auth/core/jwt"

export type AuthedEnv = { Variables: { user: AccessTokenPayload } }

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

export const honoAuthMiddleware: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  const token = readCookie(c.req.header("cookie"), ACCESS_TOKEN_COOKIE)
  if (!token) throw new HTTPException(401, { message: "Unauthorized" })

  const payload = verifyAccessToken(token, env.JWT_SECRET)
  if (!payload) throw new HTTPException(401, { message: "Unauthorized" })

  c.set("user", payload)
  await next()
}
