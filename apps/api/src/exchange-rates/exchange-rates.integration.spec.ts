import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
} from "../test/setup"
import { ExchangeRateRepository } from "./exchange-rate.repository"
import { ExchangeRateService } from "./exchange-rate.service"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { GetLatestRatesQuery } from "./queries/get-latest-rates.query"

let repo: ExchangeRateRepository
let service: ExchangeRateService
let commandBus: CommandBus
let queryBus: QueryBus

beforeAll(async () => {
  const ctx = await createTestApp()
  repo = ctx.app.get(ExchangeRateRepository)
  service = ctx.app.get(ExchangeRateService)
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

describe("ExchangeRateRepository", () => {
  it("upserts and retrieves a rate", async () => {
    await repo.upsertRates("2026-04-11", "UAH", { PLN: 0.08354, USD: 0.02302 })

    const rate = await repo.findRate("2026-04-11", "UAH", "PLN")
    expect(rate).toBeCloseTo(0.08354, 5)
  })

  it("returns null for missing rate", async () => {
    const rate = await repo.findRate("2026-04-11", "UAH", "GBP")
    expect(rate).toBeNull()
  })

  it("upserts without duplicating on conflict", async () => {
    await repo.upsertRates("2026-04-11", "UAH", { PLN: 0.08354 })
    await repo.upsertRates("2026-04-11", "UAH", { PLN: 0.09000 })

    const rate = await repo.findRate("2026-04-11", "UAH", "PLN")
    expect(rate).toBeCloseTo(0.09, 5)
  })

  it("finds all rates for a base and date", async () => {
    await repo.upsertRates("2026-04-11", "UAH", { PLN: 0.08354, USD: 0.02302 })

    const rates = await repo.findRates("2026-04-11", "UAH")
    expect(rates["PLN"]).toBeCloseTo(0.08354, 5)
    expect(rates["USD"]).toBeCloseTo(0.02302, 5)
  })
})

describe("ExchangeRateService", () => {
  it("returns 1 when base equals target", async () => {
    const rate = await service.getRate("UAH", "UAH", new Date())
    expect(rate).toBe(1)
  })

  it("fetches and caches a rate", async () => {
    const rate = await service.getRate("UAH", "PLN", new Date())
    expect(rate).toBeGreaterThan(0)

    // Verify it was cached in DB
    const cached = await repo.findRate(
      new Date().toISOString().split("T")[0],
      "UAH",
      "PLN",
    )
    expect(cached).toBeCloseTo(rate, 5)
  })

  it("returns latest rates for multiple currencies", async () => {
    const rates = await service.getLatestRates(["UAH", "PLN", "USD"])

    expect(rates["UAH"]["PLN"]).toBeGreaterThan(0)
    expect(rates["UAH"]["USD"]).toBeGreaterThan(0)
    expect(rates["PLN"]["UAH"]).toBeGreaterThan(0)
    expect(rates["USD"]["UAH"]).toBeGreaterThan(0)
    // No self-pairs
    expect(rates["UAH"]["UAH"]).toBeUndefined()
  })

  it("only stores rates for used currencies", async () => {
    const usedCurrencies = ["UAH", "PLN"]
    await service.getRate("UAH", "PLN", new Date(), usedCurrencies)

    const allStored = await repo.findRates(
      new Date().toISOString().split("T")[0],
      "UAH"
    )
    const storedTargets = Object.keys(allStored)
    // Should only contain currencies from the used list (excluding base)
    expect(storedTargets).toEqual(["PLN"])
  })
})

describe("GetLatestRatesQuery", () => {
  let organizationId: string
  let userId: string

  beforeEach(async () => {
    await truncateAll()
    const result = await signupUser()
    organizationId = result.accessToken.organizationId
    userId = result.accessToken.sub
  })

  it("returns empty rates when user has one currency", async () => {
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH"),
    )

    const result = await queryBus.execute(new GetLatestRatesQuery(organizationId))
    expect(result.rates).toEqual({})
  })

  it("returns cross-pairs for multiple currencies", async () => {
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "UAH Bank", "bank", "UAH"),
    )
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "USD Cash", "cash", "USD"),
    )

    const result = await queryBus.execute(new GetLatestRatesQuery(organizationId))
    expect(result.rates["UAH"]["USD"]).toBeGreaterThan(0)
    expect(result.rates["USD"]["UAH"]).toBeGreaterThan(0)
  })
})
