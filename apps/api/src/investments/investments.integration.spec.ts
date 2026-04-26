import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { eq } from "drizzle-orm"
import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest"
import { type DbClient, accounts as accountsTable } from "@workspace/db"
import { createTestApp, closeTestApp, truncateAll, signupUser } from "../test/setup"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { DeleteAccountCommand } from "../accounts/commands/delete-account.command"
import { GetAccountsQuery } from "../accounts/queries/get-accounts.query"
import { CreateTradeCommand } from "./commands/create-trade.command"
import { UpdateTradeCommand } from "./commands/update-trade.command"
import { DeleteTradeCommand } from "./commands/delete-trade.command"
import { ImportTradesCommand } from "./commands/import-trades.command"
import { GetPositionsQuery } from "./queries/get-positions.query"
import { GetPositionBySymbolQuery } from "./queries/get-position-by-symbol.query"
import { GetTradesQuery } from "./queries/get-trades.query"

const IMPORT_FIXTURES = join(__dirname, "import", "fixtures")

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

let commandBus: CommandBus
let queryBus: QueryBus
let db: DbClient
let organizationId: string
let userId: string

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
  db = ctx.db
})
afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  quoteMock.mockReset()
  searchMock.mockReset()
  quoteMock.mockResolvedValue([
    {
      symbol: "AAPL",
      longName: "Apple Inc.",
      fullExchangeName: "NasdaqGS",
      currency: "USD",
      regularMarketPrice: 200,
    },
  ])
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
})

async function makeBrokerage() {
  return commandBus.execute(
    new CreateAccountCommand(organizationId, userId, "IBKR USD", "brokerage", "USD", 10_000)
  )
}

describe("Investments", () => {
  it("creates a buy trade atomically (trade + cash tx + position)", async () => {
    const account = await makeBrokerage()

    const trade = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        fees: 1,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    expect(trade.symbol).toBe("AAPL")
    expect(trade.type).toBe("buy")
    expect(trade.quantity).toBe(10)

    const { positions } = await queryBus.execute(new GetPositionsQuery(organizationId, userId))
    expect(positions).toHaveLength(1)
    expect(positions[0].symbol).toBe("AAPL")
    expect(positions[0].quantity).toBe(10)
    expect(positions[0].averageCost).toBeCloseTo(150.1, 2)
    expect(positions[0].currentPrice).toBe(200)
  })

  it("rejects sell > current quantity", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 5,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )
    await expect(
      commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: account.id,
          symbol: "AAPL",
          type: "sell",
          quantity: 10,
          price: 200,
          date: new Date("2026-04-02T00:00:00Z"),
        })
      )
    ).rejects.toThrow(/negative position quantity/i)
  })

  it("rejects trade on non-brokerage account", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "USD", 1000)
    )
    await expect(
      commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: account.id,
          symbol: "AAPL",
          type: "buy",
          quantity: 1,
          price: 100,
          date: new Date(),
        })
      )
    ).rejects.toThrow(/brokerage/)
  })

  it("rejects future-dated trade", async () => {
    const account = await makeBrokerage()
    const future = new Date(Date.now() + 86_400_000)
    await expect(
      commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: account.id,
          symbol: "AAPL",
          type: "buy",
          quantity: 1,
          price: 100,
          date: future,
        })
      )
    ).rejects.toThrow(/Future/)
  })

  it("rejects currency mismatch", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "EUR Broker", "brokerage", "EUR", 10_000)
    )
    await expect(
      commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: account.id,
          symbol: "AAPL",
          type: "buy",
          quantity: 1,
          price: 100,
          date: new Date("2026-04-01"),
        })
      )
    ).rejects.toThrow(/currency/i)
  })

  it("deletes a trade and reverts position", async () => {
    const account = await makeBrokerage()
    const trade = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    await commandBus.execute(new DeleteTradeCommand(trade.id, organizationId))

    const { positions } = await queryBus.execute(new GetPositionsQuery(organizationId, userId))
    // No remaining trades for AAPL → not in the positions list.
    expect(positions.find((p) => p.symbol === "AAPL")).toBeUndefined()
  })

  it("keeps closed-but-realized positions in the list", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "sell",
        quantity: 10,
        price: 200,
        date: new Date("2026-04-15T00:00:00Z"),
      })
    )

    const { positions } = await queryBus.execute(
      new GetPositionsQuery(organizationId, userId)
    )
    const aapl = positions.find((p) => p.symbol === "AAPL")
    expect(aapl).toBeDefined()
    expect(aapl!.quantity).toBe(0)
    expect(aapl!.realizedGain).toBeCloseTo(500, 2)
  })

  it("getPositionBySymbol returns the position by (account, symbol)", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    const position = await queryBus.execute(
      new GetPositionBySymbolQuery(account.id, "AAPL", organizationId, userId)
    )
    expect(position.symbol).toBe("AAPL")
    expect(position.quantity).toBe(10)
  })

  it("getPositionBySymbol throws 404 for never-traded symbol on the account", async () => {
    const account = await makeBrokerage()
    await expect(
      queryBus.execute(
        new GetPositionBySymbolQuery(account.id, "AAPL", organizationId, userId)
      )
    ).rejects.toThrow(/not found/i)
  })

  it("serializes concurrent sells via advisory lock (no oversell)", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    const sell = () =>
      commandBus.execute(
        new CreateTradeCommand({
          organizationId,
          accountId: account.id,
          symbol: "AAPL",
          type: "sell",
          quantity: 10,
          price: 200,
          date: new Date("2026-04-15T00:00:00Z"),
        })
      )

    const results = await Promise.allSettled([sell(), sell()])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /negative position quantity/i
    )
  })

  it("updates a trade and recomputes position", async () => {
    const account = await makeBrokerage()
    const trade = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    await commandBus.execute(
      new UpdateTradeCommand({
        id: trade.id,
        organizationId,
        quantity: 20,
      })
    )

    const { positions } = await queryBus.execute(new GetPositionsQuery(organizationId, userId))
    expect(positions[0].quantity).toBe(20)
    expect(positions[0].averageCost).toBeCloseTo(150, 4)
  })

  it("rejects deleting a brokerage account with open positions", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )

    await expect(
      commandBus.execute(new DeleteAccountCommand(account.id, organizationId))
    ).rejects.toThrow(/position/i)
  })

  it("records a dividend as a trade without position changes", async () => {
    const account = await makeBrokerage()
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 150,
        date: new Date("2026-04-01T00:00:00Z"),
      })
    )
    const div = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "dividend",
        amount: 25,
        date: new Date("2026-04-10T00:00:00Z"),
      })
    )
    expect(div.type).toBe("dividend")
    expect(div.amount).toBe(25)

    const trades = await queryBus.execute(
      new GetTradesQuery({ organizationId, accountId: account.id })
    )
    expect(trades).toHaveLength(2)
    expect(trades.find((t) => t.type === "dividend")?.amount).toBe(25)
  })

  it("creates a dividend with withheld tax: balance impact = amount + withheldTax", async () => {
    const account = await makeBrokerage()
    // First buy so the position exists (dividends require holding). Buy spends
    // 10 × 100 = $1000.
    await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 10,
        price: 100,
        date: new Date("2026-01-01T00:00:00Z"),
      })
    )
    const dividend = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "dividend",
        amount: 5.0,
        withheldTax: -0.75,
        date: new Date("2026-02-01T00:00:00Z"),
      })
    )
    expect(dividend.type).toBe("dividend")
    expect(dividend.amount).toBe(5.0)
    expect(dividend.withheldTax).toBe(-0.75)

    // Account starts at 10_000. After -1000 buy and +(5 - 0.75) dividend net
    // cash, the cash sleeve should be 10_000 - 1000 + 4.25 = 9004.25.
    const accountsList = await queryBus.execute(
      new GetAccountsQuery(organizationId, userId)
    )
    const broker = accountsList.find((a) => a.id === account.id)
    expect(broker!.balance).toBeCloseTo(9004.25, 2)
  })

  it("stores externalSource / externalId / externalMetadata on imported buy", async () => {
    const account = await makeBrokerage()
    const trade = await commandBus.execute(
      new CreateTradeCommand({
        organizationId,
        accountId: account.id,
        symbol: "AAPL",
        type: "buy",
        quantity: 1,
        price: 100,
        date: new Date("2026-01-01T00:00:00Z"),
        externalSource: "ibkr_flex_query",
        externalId: "TRADE-12345",
        externalMetadata: { section: "trades", execId: "exec-1" },
      })
    )
    expect(trade.externalId).toBe("TRADE-12345")
    expect(trade.externalSource).toBe("ibkr_flex_query")
    expect(trade.externalMetadata).toEqual({ section: "trades", execId: "exec-1" })
  })
})

describe("Investments · Import", () => {
  beforeEach(() => {
    quoteMock.mockImplementation(async (symbols: string[]) => {
      return symbols.map((s) => ({
        symbol: s,
        longName: `${s} Fund`,
        fullExchangeName: "NMS",
        currency: "USD",
        regularMarketPrice: 100,
      }))
    })
  })

  it("dry-run: returns preview without writing", async () => {
    const account = await makeBrokerage()
    const csv = readFileSync(join(IMPORT_FIXTURES, "trades-only.csv"))
    const result = await commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId: account.id,
        fileBuffer: csv,
        dryRun: true,
      })
    )
    expect(result.committed).toBe(false)
    expect(result.createdCount).toBe(0)
    expect(result.summary.tradesFound).toBe(1)
    expect(result.summary.tradesToCreate).toBe(1)
    expect(result.rows[0].status).toBe("new")

    const trades = await queryBus.execute(
      new GetTradesQuery({ organizationId, accountId: account.id })
    )
    expect(trades).toHaveLength(0)
  })

  it("commit: writes trades and bumps initial_balance with deposits", async () => {
    const account = await makeBrokerage()
    const before = await db
      .select({ initialBalance: accountsTable.initialBalance })
      .from(accountsTable)
      .where(eq(accountsTable.id, account.id))
    const initialBefore = before[0].initialBalance

    const csv = readFileSync(join(IMPORT_FIXTURES, "trades-and-dividends.csv"))
    const result = await commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId: account.id,
        fileBuffer: csv,
        dryRun: false,
      })
    )
    expect(result.committed).toBe(true)
    expect(result.createdCount).toBeGreaterThan(0)
    expect(result.summary.depositsFound).toBe(5)
    expect(result.summary.depositsTotalAmount).toBe(5000)

    const trades = await queryBus.execute(
      new GetTradesQuery({ organizationId, accountId: account.id })
    )
    expect(trades.length).toBe(result.createdCount)
    expect(trades.every((t) => t.externalSource === "ibkr_flex_query")).toBe(true)
    expect(trades.every((t) => t.externalId !== null && t.externalId !== "")).toBe(true)

    // Deposits don't write transactions any more — they fold into initial_balance.
    // The `money` customType returns dollars on read, so we expect a +6000 delta.
    const after = await db
      .select({ initialBalance: accountsTable.initialBalance })
      .from(accountsTable)
      .where(eq(accountsTable.id, account.id))
    expect(after[0].initialBalance - initialBefore).toBe(5000)
  })

  it("re-import: trades dedup, deposits double-bump (user-beware)", async () => {
    const account = await makeBrokerage()
    const csv = readFileSync(join(IMPORT_FIXTURES, "trades-and-dividends.csv"))
    const first = await commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId: account.id,
        fileBuffer: csv,
        dryRun: false,
      })
    )
    expect(first.createdCount).toBeGreaterThan(0)

    const second = await commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId: account.id,
        fileBuffer: csv,
        dryRun: false,
      })
    )
    expect(second.createdCount).toBe(0)
    expect(second.summary.tradesSkippedAsDuplicate).toBeGreaterThan(0)
    expect(second.summary.dividendsSkippedAsDuplicate).toBeGreaterThan(0)
    // Deposits don't dedup — they bump initial_balance every time.
    expect(second.summary.depositsTotalAmount).toBe(5000)
  })

  it("commit rejected when any row has status=error", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "EUR", "brokerage", "EUR", 10_000)
    )
    const csv = readFileSync(join(IMPORT_FIXTURES, "trades-only.csv"))
    await expect(
      commandBus.execute(
        new ImportTradesCommand({
          organizationId,
          accountId: account.id,
          fileBuffer: csv,
          dryRun: false,
        })
      )
    ).rejects.toThrow(/cannot import with row errors/i)
  })

  it("populates account.external_account_id on first successful import", async () => {
    const account = await makeBrokerage()
    const csv = readFileSync(join(IMPORT_FIXTURES, "trades-only.csv"))
    await commandBus.execute(
      new ImportTradesCommand({
        organizationId,
        accountId: account.id,
        fileBuffer: csv,
        dryRun: false,
      })
    )
    const [row] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, account.id))
    expect(row.externalAccountId).toBe("U0000000")
  })
})
