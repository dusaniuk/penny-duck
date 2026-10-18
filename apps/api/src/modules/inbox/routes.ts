import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  AcceptInboxItemSchema,
  ListInboxQuerySchema,
  UndoInboxItemSchema,
  WalletIngestSchema,
} from "@workspace/api-contract"
import {
  apiKeyAuthMiddleware,
  type IngestPrincipal,
} from "@/middleware/api-key"
import { honoAuthMiddleware, type AuthedUser } from "@/middleware/auth"
import {
  acceptInboxItem,
  dismissInboxItem,
  ingestWalletTap,
  listInboxItems,
  undoInboxItem,
} from "./service"

export type InboxEnv = {
  Variables: { user: AuthedUser; ingest: IngestPrincipal }
}

const IdParamSchema = z.object({ id: z.uuid() })

export const inboxRoutes = new Hono<InboxEnv>()
  .post(
    "/wallet",
    apiKeyAuthMiddleware,
    zValidator("json", WalletIngestSchema),
    async (c) => {
      const principal = c.get("ingest")
      const body = c.req.valid("json")
      const { item, created } = await ingestWalletTap({
        organizationId: principal.organizationId,
        userId: principal.userId,
        card: body.card,
        amount: body.amount,
        currency: body.currency,
        merchant: body.merchant,
        description: body.description,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      })
      return c.json(item, created ? 201 : 200)
    }
  )
  .get(
    "/",
    honoAuthMiddleware,
    zValidator("query", ListInboxQuerySchema),
    async (c) => {
      const user = c.get("user")
      const query = c.req.valid("query")
      const result = await listInboxItems({
        organizationId: user.organizationId,
        status: query.status,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
      })
      return c.json(result)
    }
  )
  .post(
    "/:id/accept",
    honoAuthMiddleware,
    zValidator("param", IdParamSchema),
    zValidator("json", AcceptInboxItemSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const result = await acceptInboxItem({
        id,
        organizationId: user.organizationId,
        userId: user.sub,
        accountId: body.accountId,
        categoryId: body.categoryId,
        saveCardLabel: body.saveCardLabel,
      })
      return c.json(result)
    }
  )
  .post(
    "/:id/dismiss",
    honoAuthMiddleware,
    zValidator("param", IdParamSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const item = await dismissInboxItem(id, user.organizationId)
      return c.json(item)
    }
  )
  .post(
    "/:id/undo",
    honoAuthMiddleware,
    zValidator("param", IdParamSchema),
    zValidator("json", UndoInboxItemSchema),
    async (c) => {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const item = await undoInboxItem({
        id,
        organizationId: user.organizationId,
        forgetCardLabel: body.forgetCardLabel,
      })
      return c.json(item)
    }
  )
