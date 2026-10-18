import type { MiddlewareHandler } from "hono"
import { logger } from "@/logger"
import type { IngestPrincipal } from "./api-key"
import type { AuthedUser } from "./auth"

type Principals = { user?: AuthedUser; ingest?: IngestPrincipal }

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()

  const { status } = c.res
  const { user, ingest } = c.var as Principals
  const line = {
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs: Math.round(performance.now() - start),
    userId: user?.sub ?? ingest?.userId,
    err: status >= 500 ? c.error : undefined,
  }
  const message = `${line.method} ${line.path} ${status}`

  if (status >= 500) logger.error(line, message)
  else if (status >= 400) logger.warn(line, message)
  else logger.info(line, message)
}
