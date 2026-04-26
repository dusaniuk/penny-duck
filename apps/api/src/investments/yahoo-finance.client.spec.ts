import { describe, it, expect, vi, beforeEach } from "vitest"
import { YahooFinanceClient, RateLimitedError } from "./yahoo-finance.client"

const quoteMock = vi.fn()
const searchMock = vi.fn()

vi.mock("yahoo-finance2", () => ({
  default: class YahooFinance {
    quote(...args: unknown[]) {
      return quoteMock(...args)
    }
    search(...args: unknown[]) {
      return searchMock(...args)
    }
  },
}))

beforeEach(() => {
  quoteMock.mockReset()
  searchMock.mockReset()
})

describe("YahooFinanceClient.fetchQuotes", () => {
  it("maps quote responses to normalized shape", async () => {
    quoteMock.mockResolvedValue([
      {
        symbol: "AAPL",
        longName: "Apple Inc.",
        fullExchangeName: "NasdaqGS",
        currency: "USD",
        regularMarketPrice: 192.34,
      },
    ])
    const client = new YahooFinanceClient()
    const result = await client.fetchQuotes(["AAPL"])
    expect(result).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NasdaqGS",
        currency: "USD",
        price: 192.34,
      },
    ])
  })

  it("omits symbols with no price", async () => {
    quoteMock.mockResolvedValue([
      { symbol: "AAPL", regularMarketPrice: undefined, currency: "USD", longName: "Apple" },
    ])
    const client = new YahooFinanceClient()
    const result = await client.fetchQuotes(["AAPL"])
    expect(result).toEqual([])
  })

  it("translates 429 into RateLimitedError", async () => {
    quoteMock.mockRejectedValue(Object.assign(new Error("Too many"), { name: "HTTPError", response: { status: 429 } }))
    const client = new YahooFinanceClient()
    await expect(client.fetchQuotes(["AAPL"])).rejects.toBeInstanceOf(RateLimitedError)
  })

  it("rethrows other errors", async () => {
    quoteMock.mockRejectedValue(new Error("network"))
    const client = new YahooFinanceClient()
    await expect(client.fetchQuotes(["AAPL"])).rejects.toThrow("network")
  })

  it("returns empty array when called with no symbols", async () => {
    const client = new YahooFinanceClient()
    const result = await client.fetchQuotes([])
    expect(result).toEqual([])
    expect(quoteMock).not.toHaveBeenCalled()
  })
})

describe("YahooFinanceClient.search", () => {
  it("maps search quote entries and filters to equity/etf", async () => {
    searchMock.mockResolvedValue({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NAS", quoteType: "EQUITY" },
        { symbol: "MSFT", shortname: "Microsoft", exchange: "NAS", quoteType: "EQUITY" },
        { symbol: "SOMETHING", quoteType: "NEWS" },
      ],
    })
    const client = new YahooFinanceClient()
    const result = await client.search("apple")
    expect(result).toEqual([
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NAS" },
      { symbol: "MSFT", name: "Microsoft", exchange: "NAS" },
    ])
  })

  it("returns empty list when yahoo returns no quotes field", async () => {
    searchMock.mockResolvedValue({})
    const client = new YahooFinanceClient()
    const result = await client.search("xyz")
    expect(result).toEqual([])
  })

  it("translates 429 on search into RateLimitedError", async () => {
    searchMock.mockRejectedValue(Object.assign(new Error("Too many"), { response: { status: 429 } }))
    const client = new YahooFinanceClient()
    await expect(client.search("xyz")).rejects.toBeInstanceOf(RateLimitedError)
  })
})
