import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { listSessions, revokeOtherSessions, revokeSession } from "./service"

const IdParamSchema = z.object({ id: z.uuid() })

export const sessionsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/", async (c) => {
    const user = c.get("user")
    return c.json(await listSessions(user.sub, user.sessionId))
  })
  .delete("/others", async (c) => {
    const user = c.get("user")
    return c.json(await revokeOtherSessions(user.sub, user.sessionId))
  })
  .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    await revokeSession(user.sub, user.sessionId, id)
    return c.json({ message: "Session revoked" })
  })
