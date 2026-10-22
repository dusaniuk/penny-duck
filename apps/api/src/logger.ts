import { tryGetContext } from "hono/context-storage"
import pino from "pino"

const nodeEnv = process.env.NODE_ENV

const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-serverless-authorization",
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "secret",
]

const SEVERITIES: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
}

export function toSeverity(label: string): string {
  return SEVERITIES[label] ?? "DEFAULT"
}

// Cloud Logging reads `message`, `severity` and an ISO `time` from JSON lines.
export const logger = pino({
  level: nodeEnv === "test" ? "silent" : "info",
  base: undefined,
  messageKey: "message",
  errorKey: "err",
  formatters: {
    level: (label) => ({ severity: toSeverity(label) }),
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
