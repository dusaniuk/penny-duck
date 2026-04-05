import { describe, expect, it } from "vitest"
import { Currency } from "./currency.vo"

describe("Currency", () => {
  it("creates a valid currency", () => {
    const currency = Currency.create("UAH")
    expect(currency.value).toBe("UAH")
  })
  it("normalizes to uppercase", () => {
    const currency = Currency.create("uah")
    expect(currency.value).toBe("UAH")
  })
  it("rejects empty string", () => {
    expect(() => Currency.create("")).toThrow("Currency code cannot be empty")
  })
  it("rejects invalid length", () => {
    expect(() => Currency.create("US")).toThrow(
      "Currency code must be 3 characters"
    )
  })
  it("accepts common currencies", () => {
    expect(Currency.create("USD").value).toBe("USD")
    expect(Currency.create("PLN").value).toBe("PLN")
    expect(Currency.create("EUR").value).toBe("EUR")
  })

  it("rejects unknown 3-letter codes", () => {
    expect(() => Currency.create("FOO")).toThrow("Invalid currency code: FOO")
  })

  it("rejects another unknown code", () => {
    expect(() => Currency.create("XXX")).toThrow("Invalid currency code: XXX")
  })
})
