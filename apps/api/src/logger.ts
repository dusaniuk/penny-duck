import { tryGetContext } from "hono/context-storage"
import pino from "pino"

const nodeEnv = process.env.NODE_ENV

const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "secret",
]

// Railway's log explorer reads `message` and a string `level`.
export const logger = pino({
  level: nodeEnv === "test" ? "silent" : "info",
  base: undefined,
  messageKey: "message",
  errorKey: "err",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => {
    const requestId = tryGetContext()?.var.requestId
    return requestId ? { requestId } : {}
  },
  redact: {
    paths: REDACTED_KEYS.flatMap((key) => [
      `["${key}"]`,
      `*["${key}"]`,
      `*.*["${key}"]`,
    ]),
    censor: "[redacted]",
  },
  transport:
    nodeEnv === "production" || nodeEnv === "test"
      ? undefined
      : { target: "pino-pretty", options: { messageKey: "message" } },
})
