import { CommandBus } from "@nestjs/cqrs"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"
import { CreateAccountCommand } from "@/accounts/commands/create-account.command"
import {
  createTransaction,
  createTransfer,
} from "@/hono/modules/transactions/service"
import { listCategories } from "@/hono/modules/categories/service"
import { getMonthlySummary } from "./service"

let commandBus: CommandBus
let organizationId: string
let userId: string

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
  await flushEvents()
})

describe("getMonthlySummary", () => {
  it("zero-fills months when no transactions exist", async () => {
    const result = await getMonthlySummary(organizationId, "UAH", 6)

    expect(result).toHaveLength(6)
    for (const item of result) {
      expect(item.income).toBe(0)
      expect(item.expenses).toBe(0)
      expect(item.month).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  it("aggregates income and expenses for the current month", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000),
    )
    const categories = await listCategories(organizationId)
    const categoryId = categories[0].id

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 150,
      categoryId,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "income",
      amount: 500,
      categoryId,
      date: new Date(),
      madeById: userId,
    })

    const result = await getMonthlySummary(organizationId, "UAH", 6)
    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(500)
    expect(currentMonth.expenses).toBe(150)
  })

  it("excludes transfers from the summary", async () => {
    const account1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000),
    )
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "cash", "UAH", 0),
    )

    await createTransfer({
      organizationId,
      fromAccountId: account1.id,
      toAccountId: account2.id,
      amount: 200,
      date: new Date(),
      madeById: userId,
    })

    const result = await getMonthlySummary(organizationId, "UAH", 6)
    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(0)
    expect(currentMonth.expenses).toBe(0)
  })

  it("returns the requested number of months", async () => {
    const result = await getMonthlySummary(organizationId, "UAH", 12)
    expect(result).toHaveLength(12)
  })
})
