import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  CreateAccountSchema,
  UpdateAccountSchema,
} from "@workspace/api-contract"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import {
  clearDefaultAccount,
  createAccount,
  deleteAccount,
  getAccount,
  getAccountUsage,
  listAccounts,
  setDefaultAccount,
  updateAccount,
} from "./service"

const IdParamSchema = z.object({ id: z.uuid() })

export const accountsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/", async (c) => {
    const user = c.get("user")
    const result = await listAccounts(user.organizationId, user.sub)
    return c.json(result)
  })
  .get("/usage", async (c) => {
    const user = c.get("user")
    const result = await getAccountUsage(user.organizationId)
    return c.json(result)
  })
  .post("/", zValidator("json", CreateAccountSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const account = await createAccount({
      organizationId: user.organizationId,
      userId: user.sub,
      name: body.name,
      type: body.type,
      currency: body.currency,
      color: body.color,
      icon: body.icon,
      balance: body.balance,
      isDefault: body.isDefault,
    })
    return c.json(account, 201)
  })
  .get("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    const account = await getAccount(id, user.organizationId, user.sub)
    return c.json(account)
  })
  .patch(
    "/:id",
    zValidator("param", IdParamSchema),
    zValidator("json", UpdateAccountSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const account = await updateAccount({
        id,
        organizationId: user.organizationId,
        userId: user.sub,
        name: body.name,
        type: body.type,
        color: body.color,
        icon: body.icon,
        isDefault: body.isDefault,
      })
      return c.json(account)
    },
  )
  .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    await deleteAccount(id, user.organizationId, user.sub)
    return c.json({ message: "Account deleted" })
  })
  .put("/:id/default", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    const account = await setDefaultAccount(user.sub, user.organizationId, id)
    return c.json(account)
  })
  .delete("/:id/default", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    await clearDefaultAccount(user.sub, user.organizationId)
    return c.json({ message: "Default cleared" })
  })
