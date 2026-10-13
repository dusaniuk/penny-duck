import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { auth } from "@/modules/auth/auth"
import { findMembershipOrgId } from "@/modules/auth/organization"

export type IngestPrincipal = { userId: string; organizationId: string }
export type IngestEnv = { Variables: { ingest: IngestPrincipal } }

export const INBOX_WRITE_PERMISSION = { inbox: ["write"] }

export const apiKeyAuthMiddleware: MiddlewareHandler<IngestEnv> = async (
  c,
  next
) => {
  const key = c.req.header("x-api-key")
  if (!key) throw new HTTPException(401, { message: "Unauthorized" })

  const result = await auth.api.verifyApiKey({
    body: { key, permissions: INBOX_WRITE_PERMISSION },
  })
  if (!result.valid || !result.key) {
    if (result.error?.code === "RATE_LIMITED") {
      throw new HTTPException(429, { message: "Too many requests" })
    }
    throw new HTTPException(401, { message: "Unauthorized" })
  }

  const userId = result.key.referenceId
  const organizationId = await findMembershipOrgId(userId)
  if (!organizationId) throw new HTTPException(401, { message: "Unauthorized" })

  c.set("ingest", { userId, organizationId })
  await next()
}
