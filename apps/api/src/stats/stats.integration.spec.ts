import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { CreateTransactionCommand } from "../transactions/commands/create-transaction.command"
import { CreateTransferCommand } from "../transactions/commands/create-transfer.command"
import { GetMonthlySummaryQuery } from "./queries/get-monthly-summary.query"

let commandBus: CommandBus
let queryBus: QueryBus
let organizationId: string
let userId: string

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
  await flushEvents()
})

describe("Stats - Monthly Summary", () => {
  it("returns zero-filled months when no transactions exist", async () => {
    const result = await queryBus.execute(
      new GetMonthlySummaryQuery(organizationId, "UAH", 6),
    )

    expect(result).toHaveLength(6)
    for (const item of result) {
      expect(item.income).toBe(0)
      expect(item.expenses).toBe(0)
      expect(item.month).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  it("aggregates income and expenses for current month", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000),
    )

    const categories = await queryBus.execute(
      new (
        await import("../categories/queries/get-categories.query")
      ).GetCategoriesQuery(organizationId),
    )
    const categoryId = categories[0].id

    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId: account.id,
        type: "expense",
        amount: 150,
        categoryId,
        date: new Date(),
        madeById: userId,
      }),
    )

    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId: account.id,
        type: "income",
        amount: 500,
        categoryId,
        date: new Date(),
        madeById: userId,
      }),
    )

    const result = await queryBus.execute(
      new GetMonthlySummaryQuery(organizationId, "UAH", 6),
    )

    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(500)
    expect(currentMonth.expenses).toBe(150)
  })

  it("excludes transfers from summary", async () => {
    const account1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000),
    )
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "cash", "UAH", 0),
    )

    await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 200,
        date: new Date(),
        madeById: userId,
      }),
    )

    const result = await queryBus.execute(
      new GetMonthlySummaryQuery(organizationId, "UAH", 6),
    )

    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(0)
    expect(currentMonth.expenses).toBe(0)
  })

  it("returns correct number of months", async () => {
    const result = await queryBus.execute(
      new GetMonthlySummaryQuery(organizationId, "UAH", 12),
    )

    expect(result).toHaveLength(12)
  })
})
