import { env, isProduction } from "@workspace/env/api"
import { honoApp } from "./app"
import { logger } from "./logger"

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception")
  process.exit(1)
})
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection")
  process.exit(1)
})

logger.info(
  {
    version: env.GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    env: process.env.NODE_ENV ?? "development",
    production: isProduction,
    port: env.PORT,
    dbHost: new URL(env.DATABASE_URL).host,
    webUrl: env.WEB_URL,
    bun: Bun.version,
  },
  `api listening on :${env.PORT}`
)

export default {
  port: env.PORT,
  fetch: honoApp.fetch,
}
