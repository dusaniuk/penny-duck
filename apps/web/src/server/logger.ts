type Level = "info" | "warn" | "error"
type Fields = Record<string, unknown>

const isProduction = process.env.NODE_ENV === "production"

const SEVERITIES: Record<Level, string> = {
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
}

function serializeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err
  return {
    type: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause instanceof Error ? serializeError(err.cause) : err.cause,
  }
}

// Same line shape as the API's pino logger, which is what Cloud Logging parses.
function log(level: Level, message: string, fields: Fields = {}) {
  const { err, ...rest } = fields
  const line = {
    severity: SEVERITIES[level],
    time: new Date().toISOString(),
    ...rest,
    ...(err === undefined ? {} : { err: serializeError(err) }),
    message,
  }
  const write = level === "info" ? console.log : console.error
  if (isProduction) write(JSON.stringify(line))
  else write(`[${level}] ${message}`, { ...rest, err })
}

export const logger = {
  info: (message: string, fields?: Fields) => log("info", message, fields),
  warn: (message: string, fields?: Fields) => log("warn", message, fields),
  error: (message: string, fields?: Fields) => log("error", message, fields),
}
