import { Hono } from "hono"
import type { Context } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { ZodError } from "zod"
import { env } from "@workspace/env/api"
import {
  buildApiError,
  buildValidationError,
  type ApiError,
} from "@workspace/shared/errors"
import { accountsRoutes } from "@/hono/modules/accounts/routes"
import { authRoutes } from "@/hono/modules/auth/routes"
import { categoriesRoutes } from "@/hono/modules/categories/routes"
import { exchangeRatesRoutes } from "@/hono/modules/exchange-rates/routes"
import {
  instrumentsRoutes,
  investmentsRoutes,
  positionsRoutes,
  tradesRoutes,
} from "@/hono/modules/investments/routes"
import { statsRoutes } from "@/hono/modules/stats/routes"
import { transactionsRoutes } from "@/hono/modules/transactions/routes"
import { usersRoutes } from "@/hono/modules/users/routes"

type StatusForJson = Parameters<Context["json"]>[1]

function errorResponse(c: Context, body: ApiError) {
  return c.json(body, body.statusCode as StatusForJson)
}

export function attachErrorHandlers<E extends Hono>(app: E): E {
  app.notFound((c) =>
    errorResponse(c, buildApiError({ statusCode: 404, message: "Not found" })),
  )

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const cause = err.cause
      if (cause instanceof ZodError) {
        return errorResponse(c, buildValidationError(cause.issues))
      }
      return errorResponse(
        c,
        buildApiError({
          statusCode: err.status,
          message: err.message || "Error",
        }),
      )
    }

    if (err instanceof ZodError) {
      return errorResponse(c, buildValidationError(err.issues))
    }

    console.error(err)
    return errorResponse(
      c,
      buildApiError({ statusCode: 500, message: "Internal server error" }),
    )
  })

  return app
}

export const honoApp = attachErrorHandlers(new Hono())

honoApp.use(
  "*",
  cors({
    origin: env.WEB_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
)

honoApp.get("/healthz", (c) => c.json({ status: "ok" }))

honoApp.route("/accounts", accountsRoutes)
honoApp.route("/auth", authRoutes)
honoApp.route("/categories", categoriesRoutes)
honoApp.route("/exchange-rates", exchangeRatesRoutes)
honoApp.route("/stats", statsRoutes)
honoApp.route("/instruments", instrumentsRoutes)
honoApp.route("/positions", positionsRoutes)
honoApp.route("/trades", tradesRoutes)
honoApp.route("/investments", investmentsRoutes)
honoApp.route("/transactions", transactionsRoutes)
honoApp.route("/users", usersRoutes)
