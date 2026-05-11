import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { users } from "@workspace/db"
import { MonthlySummaryQuerySchema } from "@workspace/api-contract"
import { db } from "@/db"
import { honoAuthMiddleware, type AuthedEnv } from "@/middleware/auth"
import { getMonthlySummary } from "./service"

export const statsRoutes = new Hono<AuthedEnv>()
  .use("*", honoAuthMiddleware)
  .get(
    "/monthly-summary",
    zValidator("query", MonthlySummaryQuerySchema),
    async (c) => {
      const user = c.get("user")
      const { months = 6 } = c.req.valid("query")

      const [row] = await db
        .select({ homeCurrency: users.homeCurrency })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1)
      const homeCurrency = row?.homeCurrency ?? "UAH"

      const summary = await getMonthlySummary(
        user.organizationId,
        homeCurrency,
        months,
      )
      return c.json(summary)
    },
  )
