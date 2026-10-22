import { definePlugin } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"
import { logger } from "./logger"

const REQUEST_ID_HEADER = "x-request-id"

function isPageOrApi(pathname: string) {
  return pathname.startsWith("/api/") || !/\.[a-z0-9]+$/i.test(pathname)
}

export default definePlugin((nitroApp) => {
  const apiProxyTarget = String(useRuntimeConfig().apiProxyTarget)
  const startedAt = new WeakMap<Request, number>()

  logger.info("web started", {
    version: process.env.GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    env: process.env.NODE_ENV ?? "development",
    apiProxyTarget,
    apiUrl: process.env.API_URL,
    bun: process.versions.bun,
  })

  nitroApp.hooks?.hook("request", (event) => {
    const { pathname } = new URL(event.req.url)
    if (!isPageOrApi(pathname)) return
    startedAt.set(event.req, performance.now())
    if (!event.req.headers.has(REQUEST_ID_HEADER)) {
      event.req.headers.set(REQUEST_ID_HEADER, crypto.randomUUID())
    }
  })

  nitroApp.hooks?.hook("response", (res, event) => {
    const start = startedAt.get(event.req)
    if (start === undefined) return
    const { pathname } = new URL(event.req.url)
    const line = {
      requestId: event.req.headers.get(REQUEST_ID_HEADER),
      method: event.req.method,
      path: pathname,
      status: res.status,
      durationMs: Math.round(performance.now() - start),
    }
    const message = `${line.method} ${line.path} ${line.status}`
    if (res.status >= 500) logger.error(message, line)
    else if (res.status >= 400) logger.warn(message, line)
    else logger.info(message, line)
  })

  nitroApp.hooks?.hook("error", (error, { event }) => {
    const status = (error as { status?: number }).status ?? 500
    if (status < 500) return
    const url = event ? new URL(event.req.url) : undefined
    const requestId = event?.req.headers.get(REQUEST_ID_HEADER)

    if (url?.pathname.startsWith("/api/")) {
      logger.error("api proxy failed", {
        requestId,
        status,
        target: `${apiProxyTarget}${url.pathname.slice(4)}${url.search}`,
        err: error,
      })
      return
    }
    logger.error("server error", {
      requestId,
      status,
      path: url?.pathname,
      err: error,
    })
  })
})
