import { Hono } from "hono"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { generateInviteCode, getInvite } from "./service"

export const invitesRoutes = new Hono<AuthedEnv>()
  .get("/:code", async (c) => {
    const result = await getInvite(c.req.param("code"))
    if (!result) return c.json({ message: "Invalid invite link" }, 404)
    return c.json(result)
  })
  .post("/", honoAuthMiddleware, async (c) => {
    const user = c.get("user")
    return c.json(await generateInviteCode(user.sub, user.organizationId))
  })
