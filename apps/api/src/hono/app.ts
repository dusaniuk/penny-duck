import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { ZodError } from "zod"
import {
  buildApiError,
  buildValidationError,
  type ApiError,
} from "@workspace/shared/errors"
import { exchangeRatesRoutes } from "@/hono/modules/exchange-rates/routes"
import {
  instrumentsRoutes,
  investmentsRoutes,
  positionsRoutes,
  tradesRoutes,
} from "@/hono/modules/investments/routes"
import { statsRoutes } from "@/hono/modules/stats/routes"

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

honoApp.route("/exchange-rates", exchangeRatesRoutes)
honoApp.route("/stats", statsRoutes)
honoApp.route("/instruments", instrumentsRoutes)
honoApp.route("/positions", positionsRoutes)
honoApp.route("/trades", tradesRoutes)
honoApp.route("/investments", investmentsRoutes)
