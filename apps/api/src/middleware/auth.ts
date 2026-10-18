import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { auth } from "@/modules/auth/auth"

export type AuthedUser = {
  sub: string
  email: string
  organizationId: string
  sessionId: string
}

export type AuthedEnv = { Variables: { user: AuthedUser } }

export const honoAuthMiddleware: MiddlewareHandler<AuthedEnv> = async (
  c,
  next
) => {
  const { headers, response } = await auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  })
  for (const cookie of headers.getSetCookie()) {
    c.header("set-cookie", cookie, { append: true })
  }

  const organizationId = response?.session.activeOrganizationId
  if (!response || typeof organizationId !== "string") {
    throw new HTTPException(401, { message: "Unauthorized" })
  }

  c.set("user", {
    sub: response.user.id,
    email: response.user.email,
    organizationId,
    sessionId: response.session.id,
  })
  await next()
}
