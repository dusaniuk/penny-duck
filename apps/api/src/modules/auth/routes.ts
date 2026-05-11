import { Hono, type Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { LoginSchema, SignupSchema } from "@workspace/api-contract"
import { env, isProduction } from "@workspace/env/api"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "./core/cookies"
import { signAccessToken } from "./core/jwt"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { rateLimit } from "./rate-limit"
import {
  generateInviteCodeService,
  getInviteService,
  loginService,
  logoutService,
  refreshService,
  signupService,
} from "./service"

const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true as const,
  secure: isProduction,
  sameSite: "Lax" as const,
  path: COOKIE_PATH,
  maxAge: Math.floor(maxAgeMs / 1000),
})

function setAuthCookies(
  c: Context,
  accessJwt: string,
  refreshToken: string,
): void {
  setCookie(
    c,
    ACCESS_TOKEN_COOKIE,
    accessJwt,
    cookieOptions(ACCESS_TOKEN_MAX_AGE_MS),
  )
  setCookie(
    c,
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    cookieOptions(REFRESH_TOKEN_MAX_AGE_MS),
  )
}

function clearAuthCookies(c: Context): void {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: COOKIE_PATH })
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH })
}

export const authRoutes = new Hono<AuthedEnv>()
  .post(
    "/signup",
    rateLimit({ limit: 3, ttl: 60_000 }),
    zValidator("json", SignupSchema),
    async (c) => {
      const body = c.req.valid("json")
      const result = await signupService(body)
      return c.json(result, 201)
    },
  )
  .post(
    "/login",
    rateLimit({ limit: 5, ttl: 60_000 }),
    zValidator("json", LoginSchema),
    async (c) => {
      const body = c.req.valid("json")
      const result = await loginService(body.email, body.password)
      const accessJwt = signAccessToken(
        result.accessToken,
        env.JWT_SECRET,
        env.JWT_EXPIRATION,
      )
      setAuthCookies(c, accessJwt, result.refreshToken)
      return c.json(result.user)
    },
  )
  .post("/refresh", rateLimit({ limit: 20, ttl: 60_000 }), async (c) => {
    const rawToken = getCookie(c, REFRESH_TOKEN_COOKIE)
    if (!rawToken) {
      clearAuthCookies(c)
      throw new HTTPException(401, { message: "No refresh token" })
    }
    const result = await refreshService(rawToken)
    const accessJwt = signAccessToken(
      result.accessToken,
      env.JWT_SECRET,
      env.JWT_EXPIRATION,
    )
    setAuthCookies(c, accessJwt, result.refreshToken)
    return c.json({ message: "Tokens refreshed" })
  })
  .post("/logout", async (c) => {
    const rawToken = getCookie(c, REFRESH_TOKEN_COOKIE)
    clearAuthCookies(c)
    if (rawToken) {
      logoutService(rawToken).catch(() => {})
    }
    return c.json({ message: "Logged out" })
  })
  .get(
    "/invite",
    zValidator("query", z.object({ code: z.string() })),
    async (c) => {
      const { code } = c.req.valid("query")
      const result = await getInviteService(code)
      if (!result) {
        return c.json({ message: "Invalid invite link" }, 404)
      }
      return c.json(result)
    },
  )
  .post("/invite-code", honoAuthMiddleware, async (c) => {
    const user = c.get("user")
    const result = await generateInviteCodeService(
      user.sub,
      user.organizationId,
    )
    return c.json(result)
  })
