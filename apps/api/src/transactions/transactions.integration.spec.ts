import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
} from "../test/setup"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { GetAccountQuery } from "../accounts/queries/get-account.query"
import { GetCategoriesQuery } from "../categories/queries/get-categories.query"
import { CreateTransactionCommand } from "./commands/create-transaction.command"
import { UpdateTransactionCommand } from "./commands/update-transaction.command"
import { DeleteTransactionCommand } from "./commands/delete-transaction.command"
import { SettleTransactionCommand } from "./commands/settle-transaction.command"
import { GetTransactionQuery } from "./queries/get-transaction.query"
import { ListTransactionsQuery } from "./queries/list-transactions.query"

let commandBus: CommandBus
let queryBus: QueryBus
let userId: string
let accountId: string
let categoryId: string

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  userId = result.user.id

  const account = await commandBus.execute(
    new CreateAccountCommand(userId, "Bank", "bank", "UAH", 10000)
  )
  accountId = account.id

  const categories = await queryBus.execute(new GetCategoriesQuery(userId))
  categoryId = categories[0].id
})

describe("Transactions", () => {
  it("creates an expense transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50.25,
        categoryId,
        date: new Date(),
        note: "lunch",
      })
    )

    expect(tx.id).toBeDefined()
    expect(tx.type).toBe("expense")
    expect(tx.amount).toBe(50.25)
    expect(tx.note).toBe("lunch")
    expect(tx.settled).toBe(true)
  })

  it("creates an income transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "income",
        amount: 1000,
        categoryId,
        date: new Date(),
      })
    )

    expect(tx.type).toBe("income")
    expect(tx.amount).toBe(1000)
  })

  it("creates a shared (unsettled) transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        myShare: 40,
      })
    )

    expect(tx.myShare).toBe(40)
    expect(tx.settled).toBe(false)
  })

  it("creates a transaction with exchange rate", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
      })
    )

    expect(tx.originalAmount).toBe(4152)
    expect(tx.originalCurrency).toBe("UAH")
    expect(tx.exchangeRate).toBe(41.52)
  })

  it("gets a single transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
    )

    const found = await queryBus.execute(
      new GetTransactionQuery(created.id, userId)
    )

    expect(found.id).toBe(created.id)
    expect(found.amount).toBe(50)
  })

  it("lists transactions with pagination", async () => {
    for (let i = 0; i < 3; i++) {
      await commandBus.execute(
        new CreateTransactionCommand({
          userId,
          accountId,
          type: "expense",
          amount: 10 * (i + 1),
          categoryId,
          date: new Date(),
        })
      )
    }

    const result = await queryBus.execute(
      new ListTransactionsQuery(userId, { page: 1, limit: 10 })
    )

    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it("filters transactions by type", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
    )
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "income",
        amount: 100,
        categoryId,
        date: new Date(),
      })
    )

    const result = await queryBus.execute(
      new ListTransactionsQuery(userId, { page: 1, limit: 10, type: "expense" })
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].type).toBe("expense")
  })

  it("filters transactions by settled status", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        myShare: 40,
      })
    )
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
    )

    const result = await queryBus.execute(
      new ListTransactionsQuery(userId, {
        page: 1,
        limit: 10,
        settled: false,
      })
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].settled).toBe(false)
  })

  it("updates a transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
    )

    const updated = await commandBus.execute(
      new UpdateTransactionCommand(created.id, userId, {
        amount: 75,
        note: "updated",
      })
    )

    expect(updated.amount).toBe(75)
    expect(updated.note).toBe("updated")
  })

  it("deletes a transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
    )

    await commandBus.execute(new DeleteTransactionCommand(created.id, userId))

    await expect(
      queryBus.execute(new GetTransactionQuery(created.id, userId))
    ).rejects.toThrow()
  })

  it("settles a shared transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        myShare: 40,
      })
    )

    const settled = await commandBus.execute(
      new SettleTransactionCommand(created.id, userId)
    )

    expect(settled.settled).toBe(true)
    expect(settled.myShare).toBe(40)
  })

  it("updates account balance on expense", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
      })
    )

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, userId)
    )
    expect(account.balance).toBe(9800)
  })

  it("updates account balance on income", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "income",
        amount: 500,
        categoryId,
        date: new Date(),
      })
    )

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, userId)
    )
    expect(account.balance).toBe(10500)
  })

  it("moves balance when changing accountId", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
      })
    )

    const updated = await commandBus.execute(
      new UpdateTransactionCommand(tx.id, userId, {
        accountId: account2.id,
      })
    )

    expect(updated.accountId).toBe(account2.id)

    const orig = await queryBus.execute(new GetAccountQuery(accountId, userId))
    expect(orig.balance).toBe(10000) // expense reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, userId)
    )
    expect(dest.balance).toBe(4800) // expense applied
  })

  it("moves balance correctly when changing accountId and amount together", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
      })
    )

    await commandBus.execute(
      new UpdateTransactionCommand(tx.id, userId, {
        accountId: account2.id,
        amount: 300,
      })
    )

    const orig = await queryBus.execute(new GetAccountQuery(accountId, userId))
    expect(orig.balance).toBe(10000) // old expense (200) reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, userId)
    )
    expect(dest.balance).toBe(4700) // new expense (300) applied
  })

  it("moves balance correctly when changing accountId on income", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "income",
        amount: 500,
        categoryId,
        date: new Date(),
      })
    )

    await commandBus.execute(
      new UpdateTransactionCommand(tx.id, userId, {
        accountId: account2.id,
      })
    )

    const orig = await queryBus.execute(new GetAccountQuery(accountId, userId))
    expect(orig.balance).toBe(10000) // income reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, userId)
    )
    expect(dest.balance).toBe(5500) // income applied
  })

  it("reverses balance on delete", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
      })
    )

    await commandBus.execute(new DeleteTransactionCommand(tx.id, userId))

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, userId)
    )
    expect(account.balance).toBe(10000)
  })
})
