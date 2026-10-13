import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  AccountSeriesQuerySchema,
  AddPocketSchema,
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
import {
  addPocket,
  createWallet,
  deletePocket,
  deleteWallet,
  loadWallet,
  updateWallet,
  walletExists,
} from "@/modules/wallets/service"
import { computeAccountSeries } from "./series"
import { HTTPException } from "hono/http-exception"

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
  .get("/series", zValidator("query", AccountSeriesQuerySchema), async (c) => {
    const user = c.get("user")
    const { days } = c.req.valid("query")
    const result = await computeAccountSeries(
      user.organizationId,
      user.sub,
      days
    )
    return c.json(result)
  })
  .post("/", zValidator("json", CreateAccountSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")

    switch (body.type) {
      case "wallet":
        const wallet = await createWallet({
          organizationId: user.organizationId,
          userId: user.sub,
          name: body.name,
          color: body.color,
          icon: body.icon,
          pockets: body.pockets,
        })
        return c.json(wallet, 201)
      case "bank":
      case "brokerage":
      case "loan":
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
          cardLabel: body.cardLabel,
        })
        return c.json(account, 201)
      default:
        throw new HTTPException(400, {
          message: `Invalid account type: ${body}`,
        })
    }
  })
  .get("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")
    if (await walletExists(id, user.organizationId)) {
      const wallet = await loadWallet(id, user.organizationId, user.sub)
      return c.json(wallet)
    }
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
      if (await walletExists(id, user.organizationId)) {
        const wallet = await updateWallet({
          id,
          organizationId: user.organizationId,
          userId: user.sub,
          name: body.name,
          color: body.color,
          icon: body.icon,
        })
        return c.json(wallet)
      }
      const account = await updateAccount({
        id,
        organizationId: user.organizationId,
        userId: user.sub,
        name: body.name,
        type: body.type,
        color: body.color,
        icon: body.icon,
        isDefault: body.isDefault,
        cardLabel: body.cardLabel,
      })
      return c.json(account)
    }
  )
  .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user")
    const { id } = c.req.valid("param")

    if (await walletExists(id, user.organizationId)) {
      await deleteWallet(id, user.organizationId)
      return c.json({ message: "Wallet deleted" })
    }

    await deleteAccount(id, user.organizationId, user.sub)
    return c.json({ message: "Account deleted" })
  })
  .post(
    "/:id/pockets",
    zValidator("param", IdParamSchema),
    zValidator("json", AddPocketSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const wallet = await addPocket({
        walletId: id,
        organizationId: user.organizationId,
        userId: user.sub,
        currency: body.currency,
        balance: body.balance,
      })
      return c.json(wallet, 201)
    }
  )
  .delete(
    "/:id/pockets/:currency",
    zValidator(
      "param",
      z.object({ id: z.uuid(), currency: z.string().length(3) })
    ),
    async (c) => {
      const user = c.get("user")
      const { id, currency } = c.req.valid("param")
      const wallet = await deletePocket(
        id,
        currency,
        user.organizationId,
        user.sub
      )
      return c.json(wallet)
    }
  )
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
