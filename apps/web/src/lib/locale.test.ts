import { describe, expect, it } from "vitest"
import { pickLocale } from "./locale"

describe("pickLocale", () => {
  it("falls back to en-US without a header", () => {
    expect(pickLocale(undefined)).toBe("en-US")
    expect(pickLocale("")).toBe("en-US")
  })

  it("takes the first preferred language", () => {
    expect(pickLocale("uk-UA,uk;q=0.9,en-US;q=0.8")).toBe("uk-UA")
  })

  it("honours q-values over order", () => {
    expect(pickLocale("en;q=0.5,de-DE;q=0.9")).toBe("de-DE")
  })

  it("skips wildcards and malformed tags", () => {
    expect(pickLocale("*,not a tag,fr-FR;q=0.8")).toBe("fr-FR")
  })
})
