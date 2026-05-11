import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import { zValidator } from "@hono/zod-validator"
import {
  DeleteAccountSchema,
  UpdateProfileSchema,
} from "@workspace/api-contract"
import {
  ACCESS_TOKEN_COOKIE,
  COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from "@/modules/auth/core/cookies"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { listMembersForOrganization } from "@/modules/organizations/service"
import {
  deleteAccount,
  getCurrentUser,
  getExportData,
  updateProfile,
} from "./service"

export const usersRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/me", async (c) => {
    const user = c.get("user")
    return c.json(await getCurrentUser(user.sub))
  })
  .patch("/me", zValidator("json", UpdateProfileSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    return c.json(await updateProfile(user.sub, body))
  })
  .delete("/me", zValidator("json", DeleteAccountSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const result = await deleteAccount(user.sub, body.email)
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: COOKIE_PATH })
    deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: COOKIE_PATH })
    return c.json(result)
  })
  .get("/me/export", async (c) => {
    const user = c.get("user")
    return c.json(await getExportData(user.sub, user.organizationId))
  })
  .get("/members", async (c) => {
    const user = c.get("user")
    return c.json(await listMembersForOrganization(user.organizationId))
  })
