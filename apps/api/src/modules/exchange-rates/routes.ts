import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { accounts } from "@workspace/db"
import { db } from "@/db"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { getLatestRates } from "./service"

export const exchangeRatesRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get("/latest", async (c) => {
    const user = c.get("user")
    const date = new Date().toISOString().split("T")[0]

    const rows = await db
      .selectDistinct({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.organizationId, user.organizationId))

    const currencies = rows.map((r) => r.currency)
    if (currencies.length <= 1) {
      return c.json({ date, rates: {} })
    }

    const rates = await getLatestRates(currencies)
    return c.json({ date, rates })
  })
