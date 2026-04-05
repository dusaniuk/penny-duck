import { describe, expect, it } from "vitest"
import { ExchangeRate } from "./exchange-rate.vo"

describe("ExchangeRate", () => {
  it("creates a valid exchange rate", () => {
    const er = ExchangeRate.create(4152, "UAH", 41.52)
    expect(er.originalAmount).toBe(4152)
    expect(er.originalCurrency).toBe("UAH")
    expect(er.rate).toBe(41.52)
  })
  it("uppercases currency code", () => {
    const er = ExchangeRate.create(100, "uah", 41.52)
    expect(er.originalCurrency).toBe("UAH")
  })
  it("rejects zero rate", () => {
    expect(() => ExchangeRate.create(100, "UAH", 0)).toThrow(
      "Exchange rate must be greater than 0"
    )
  })
  it("rejects negative rate", () => {
    expect(() => ExchangeRate.create(100, "UAH", -1)).toThrow(
      "Exchange rate must be greater than 0"
    )
  })
  it("rejects zero original amount", () => {
    expect(() => ExchangeRate.create(0, "UAH", 41.52)).toThrow(
      "Original amount must be greater than 0"
    )
  })
  it("rejects invalid currency code", () => {
    expect(() => ExchangeRate.create(100, "XX", 41.52)).toThrow()
  })
})
