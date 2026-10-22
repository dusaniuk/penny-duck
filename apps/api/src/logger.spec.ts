import { describe, expect, it } from "bun:test"
import { toSeverity } from "./logger"

describe("toSeverity", () => {
  it("maps pino labels to Cloud Logging severities", () => {
    expect(toSeverity("warn")).toBe("WARNING")
    expect(toSeverity("fatal")).toBe("CRITICAL")
    expect(toSeverity("info")).toBe("INFO")
    expect(toSeverity("bogus")).toBe("DEFAULT")
  })
})
