import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { zValidator } from "@hono/zod-validator"
import {
  CreateTradeSchema,
  InstrumentSearchQuerySchema,
  ListTradesQuerySchema,
  UpdateTradeSchema,
} from "@workspace/api-contract"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import {
  getInstrument,
  refreshAllPricesForOrg,
  searchInstruments,
} from "./instruments/service"
import {
  getPositionBySymbol,
  getPositions,
  getSummary,
} from "./positions/service"
import {
  createTrade,
  deleteTrade,
  importTrades,
  listTrades,
  updateTrade,
} from "./trades/service"

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

export const instrumentsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get(
    "/search",
    zValidator("query", InstrumentSearchQuerySchema),
    async (c) => {
      const { q } = c.req.valid("query")
      const result = await searchInstruments(q)
      return c.json(result)
    }
  )
  .post("/refresh-prices", async (c) => {
    const user = c.get("user")
    const result = await refreshAllPricesForOrg(user.organizationId)
    return c.json(result)
  })
  .get("/:symbol", async (c) => {
    const symbol = c.req.param("symbol")
    const result = await getInstrument(symbol)
    return c.json(result)
  })

export const positionsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/", async (c) => {
    const user = c.get("user")
    const result = await getPositions(user.organizationId, user.sub)
    return c.json(result)
  })
  .get("/:accountId/:symbol", async (c) => {
    const user = c.get("user")
    const accountId = c.req.param("accountId")
    const symbol = c.req.param("symbol")
    const result = await getPositionBySymbol(
      accountId,
      symbol,
      user.organizationId,
      user.sub
    )
    return c.json(result)
  })

export const tradesRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/", zValidator("query", ListTradesQuerySchema), async (c) => {
    const user = c.get("user")
    const query = c.req.valid("query")
    const result = await listTrades({
      organizationId: user.organizationId,
      accountId: query.accountId,
      symbol: query.symbol,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    })
    return c.json(result)
  })
  .post("/", zValidator("json", CreateTradeSchema), async (c) => {
    const user = c.get("user")
    const body = c.req.valid("json")
    const trade = await createTrade({
      organizationId: user.organizationId,
      accountId: body.accountId,
      symbol: body.symbol,
      type: body.type,
      quantity: body.quantity,
      price: body.price,
      amount: body.amount,
      fees: body.fees,
      date: new Date(body.date),
    })
    return c.json(trade, 201)
  })
  .post("/import", async (c) => {
    const user = c.get("user")
    const form = await c.req.parseBody()
    const file = form["file"]
    const accountId = form["accountId"]
    const dryRunRaw = form["dryRun"]

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file is required" })
    }
    if (typeof accountId !== "string" || accountId.length === 0) {
      throw new HTTPException(400, { message: "accountId is required" })
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new HTTPException(400, {
        message: `file exceeds ${MAX_IMPORT_FILE_BYTES} byte limit`,
      })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const dryRun = dryRunRaw === "true"

    const result = await importTrades({
      organizationId: user.organizationId,
      accountId,
      fileBuffer,
      dryRun,
    })
    return c.json(result)
  })
  .patch("/:id", zValidator("json", UpdateTradeSchema), async (c) => {
    const user = c.get("user")
    const id = c.req.param("id")
    const body = c.req.valid("json")
    const trade = await updateTrade({
      id,
      organizationId: user.organizationId,
      symbol: body.symbol,
      quantity: body.quantity,
      price: body.price,
      amount: body.amount,
      fees: body.fees,
      date: body.date ? new Date(body.date) : undefined,
    })
    return c.json(trade)
  })
  .delete("/:id", async (c) => {
    const user = c.get("user")
    const id = c.req.param("id")
    await deleteTrade(id, user.organizationId)
    return c.json({ message: "Trade deleted" })
  })

export const investmentsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/summary", async (c) => {
    const user = c.get("user")
    const result = await getSummary(user.organizationId, user.sub)
    return c.json(result)
  })
