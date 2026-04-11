import { ExchangeRateClient } from "./exchange-rate.client"

describe("ExchangeRateClient", () => {
  let client: ExchangeRateClient

  beforeEach(() => {
    client = new ExchangeRateClient()
  })

  it("fetches latest rates for a base currency", async () => {
    const rates = await client.fetchRates("UAH", new Date())

    expect(rates["PLN"]).toEqual(expect.any(Number))
    expect(rates["USD"]).toEqual(expect.any(Number))
    expect(rates["PLN"]).toBeGreaterThan(0)
  })

  it("normalizes currency codes to uppercase", async () => {
    const rates = await client.fetchRates("UAH", new Date())

    const keys = Object.keys(rates)
    for (const key of keys) {
      expect(key).toBe(key.toUpperCase())
    }
  })

  it("fetches historical rates", async () => {
    const pastDate = new Date("2025-06-15")
    const rates = await client.fetchRates("UAH", pastDate)

    expect(rates["USD"]).toEqual(expect.any(Number))
    expect(rates["USD"]).toBeGreaterThan(0)
  })
})
