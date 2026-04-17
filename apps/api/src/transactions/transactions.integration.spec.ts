import { BadRequestException } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { GetAccountQuery } from "../accounts/queries/get-account.query"
import { GetCategoriesQuery } from "../categories/queries/get-categories.query"
import { CreateTransactionCommand } from "./commands/create-transaction.command"
import { UpdateTransactionCommand } from "./commands/update-transaction.command"
import { DeleteTransactionCommand } from "./commands/delete-transaction.command"
import { SettleTransactionCommand } from "./commands/settle-transaction.command"
import { CreateReimbursementCommand } from "./commands/create-reimbursement.command"
import { DeleteReimbursementCommand } from "./commands/delete-reimbursement.command"
import { GetTransactionQuery } from "./queries/get-transaction.query"
import { ListTransactionsQuery } from "./queries/list-transactions.query"

let commandBus: CommandBus
let queryBus: QueryBus
let organizationId: string
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
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
  await flushEvents()

  const account = await commandBus.execute(
    new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000)
  )
  accountId = account.id

  const categories = await queryBus.execute(new GetCategoriesQuery(organizationId))
  categoryId = categories[0].id
})

describe("Transactions", () => {
  it("creates an expense transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 50.25,
        categoryId,
        date: new Date(),
        note: "lunch",
        madeById: userId,
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
        organizationId,
        accountId,
        type: "income",
        amount: 1000,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    expect(tx.type).toBe("income")
    expect(tx.amount).toBe(1000)
  })

  it("toggles settled on a transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    expect(tx.settled).toBe(true)

    const unsettled = await commandBus.execute(
      new SettleTransactionCommand(tx.id, organizationId)
    )

    expect(unsettled.settled).toBe(false)
  })

  it("creates a transaction with exchange rate", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
        madeById: userId,
      })
    )

    expect(tx.originalAmount).toBe(4152)
    expect(tx.originalCurrency).toBe("UAH")
    expect(tx.exchangeRate).toBe(41.52)
  })

  it("gets a single transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const found = await queryBus.execute(
      new GetTransactionQuery(created.id, organizationId)
    )

    expect(found.id).toBe(created.id)
    expect(found.amount).toBe(50)
  })

  it("lists transactions with pagination", async () => {
    for (let i = 0; i < 3; i++) {
      await commandBus.execute(
        new CreateTransactionCommand({
          organizationId,
          accountId,
          type: "expense",
          amount: 10 * (i + 1),
          categoryId,
          date: new Date(),
          madeById: userId,
        })
      )
    }

    const result = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", { page: 1, limit: 10 })
    )

    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it("filters transactions by type", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "income",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const result = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", { page: 1, limit: 10, type: "expense" })
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].type).toBe("expense")
  })

  it("filters transactions by settled status", async () => {
    const unsettledTx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(
      new SettleTransactionCommand(unsettledTx.id, organizationId)
    )

    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const result = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", {
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
        organizationId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const updated = await commandBus.execute(
      new UpdateTransactionCommand(created.id, organizationId, {
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
        organizationId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(new DeleteTransactionCommand(created.id, organizationId))

    await expect(
      queryBus.execute(new GetTransactionQuery(created.id, organizationId))
    ).rejects.toThrow()
  })

  it("settles an unsettled transaction", async () => {
    const created = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    // Toggle to unsettled
    await commandBus.execute(new SettleTransactionCommand(created.id, organizationId))

    // Toggle back to settled
    const settled = await commandBus.execute(
      new SettleTransactionCommand(created.id, organizationId)
    )

    expect(settled.settled).toBe(true)
  })

  it("updates account balance on expense", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, organizationId, userId)
    )
    expect(account.balance).toBe(9800)
  })

  it("updates account balance on income", async () => {
    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "income",
        amount: 500,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, organizationId, userId)
    )
    expect(account.balance).toBe(10500)
  })

  it("moves balance when changing accountId", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    const updated = await commandBus.execute(
      new UpdateTransactionCommand(tx.id, organizationId, {
        accountId: account2.id,
      })
    )

    expect(updated.accountId).toBe(account2.id)

    const orig = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(orig.balance).toBe(10000) // expense reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(dest.balance).toBe(4800) // expense applied
  })

  it("moves balance correctly when changing accountId and amount together", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(
      new UpdateTransactionCommand(tx.id, organizationId, {
        accountId: account2.id,
        amount: 300,
      })
    )

    const orig = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(orig.balance).toBe(10000) // old expense (200) reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(dest.balance).toBe(4700) // new expense (300) applied
  })

  it("moves balance correctly when changing accountId on income", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "income",
        amount: 500,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(
      new UpdateTransactionCommand(tx.id, organizationId, {
        accountId: account2.id,
      })
    )

    const orig = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(orig.balance).toBe(10000) // income reversed

    const dest = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(dest.balance).toBe(5500) // income applied
  })

  it("reverses balance on delete", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 200,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(new DeleteTransactionCommand(tx.id, organizationId))

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, organizationId, userId)
    )
    expect(account.balance).toBe(10000)
  })

  it("creates a same-account reimbursement", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    const updated = await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId,
        amount: 30,
        date: new Date(),
        madeById: userId,
      })
    )

    expect(updated.amount).toBe(70)
    expect(updated.type).toBe("expense")

    const account = await queryBus.execute(
      new GetAccountQuery(accountId, organizationId, userId)
    )
    expect(account.balance).toBe(9930)
  })

  it("creates a cross-account same-currency reimbursement", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    const updated = await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId: account2.id,
        amount: 30,
        date: new Date(),
        madeById: userId,
      })
    )

    expect(updated.amount).toBe(70)

    const acc1 = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(acc1.balance).toBe(9900)

    const acc2 = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(acc2.balance).toBe(5030)
  })

  it("creates a cross-currency reimbursement", async () => {
    const plnAccount = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "PLN Bank", "bank", "PLN", 1000)
    )
    const uahAccount = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "UAH Bank", "bank", "UAH", 0)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId: plnAccount.id,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    const updated = await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId: uahAccount.id,
        amount: 300,
        date: new Date(),
        exchangeRate: 0.1,
        madeById: userId,
      })
    )

    expect(updated.amount).toBe(70)

    const pln = await queryBus.execute(
      new GetAccountQuery(plnAccount.id, organizationId, userId)
    )
    expect(pln.balance).toBe(900)

    const uah = await queryBus.execute(
      new GetAccountQuery(uahAccount.id, organizationId, userId)
    )
    expect(uah.balance).toBe(300)
  })

  it("rejects reimbursement exceeding expense amount", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    await expect(
      commandBus.execute(
        new CreateReimbursementCommand({
          transactionId: tx.id,
          organizationId,
          accountId,
          amount: 100,
          date: new Date(),
          madeById: userId,
        })
      )
    ).rejects.toThrow(BadRequestException)
  })

  it("rejects reimbursement on income transaction", async () => {
    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "income",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )

    await expect(
      commandBus.execute(
        new CreateReimbursementCommand({
          transactionId: tx.id,
          organizationId,
          accountId,
          amount: 50,
          date: new Date(),
          madeById: userId,
        })
      )
    ).rejects.toThrow(BadRequestException)
  })

  it("rejects cross-currency reimbursement without exchange rate", async () => {
    const uahAccount = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "UAH", "bank", "UAH", 0)
    )
    const plnAccount = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "PLN", "bank", "PLN", 1000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId: plnAccount.id,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    await expect(
      commandBus.execute(
        new CreateReimbursementCommand({
          transactionId: tx.id,
          organizationId,
          accountId: uahAccount.id,
          amount: 300,
          date: new Date(),
          madeById: userId,
        })
      )
    ).rejects.toThrow(BadRequestException)
  })

  it("deletes a cross-account reimbursement and restores expense amount", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId: account2.id,
        amount: 30,
        date: new Date(),
        madeById: userId,
      })
    )

    // Find the reimbursement transfer's incoming transaction
    const list = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", {
        page: 1,
        limit: 100,
        accountId: account2.id,
      })
    )
    const reimbursementTx = list.data.find(
      (t) => t.reimbursementId === tx.id
    )

    await commandBus.execute(
      new DeleteReimbursementCommand(tx.id, reimbursementTx!.id, organizationId)
    )

    // Expense restored to 100
    const restored = await queryBus.execute(
      new GetTransactionQuery(tx.id, organizationId)
    )
    expect(restored.amount).toBe(100)

    // Balances restored
    const acc1 = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(acc1.balance).toBe(9900)

    const acc2 = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(acc2.balance).toBe(5000)
  })

  it("hides reimbursement transfers from main transaction list", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId: account2.id,
        amount: 30,
        date: new Date(),
        madeById: userId,
      })
    )

    // Main list (no accountId filter) should hide reimbursement transfers
    const mainList = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", { page: 1, limit: 100 })
    )

    expect(mainList.data).toHaveLength(1)
    expect(mainList.data[0].amount).toBe(70)

    // Account-filtered view should show reimbursement transfers
    const accountList = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", {
        page: 1,
        limit: 100,
        accountId: account2.id,
      })
    )

    expect(accountList.data).toHaveLength(1)
    expect(accountList.data[0].amount).toBe(30)
    expect(accountList.data[0].reimbursementId).toBe(tx.id)

    // Filtering by the original expense account should NOT show the
    // reimbursement's outgoing bookkeeping entry — only the reduced expense.
    const expenseAccountList = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", {
        page: 1,
        limit: 100,
        accountId,
      })
    )

    expect(expenseAccountList.data).toHaveLength(1)
    expect(expenseAccountList.data[0].id).toBe(tx.id)
    expect(expenseAccountList.data[0].amount).toBe(70)
  })

  it("deleting an expense cascades to its reimbursement transfers", async () => {
    const account2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "wallet", "UAH", 5000)
    )

    const tx = await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        madeById: userId,
      })
    )
    await commandBus.execute(new SettleTransactionCommand(tx.id, organizationId))

    await commandBus.execute(
      new CreateReimbursementCommand({
        transactionId: tx.id,
        organizationId,
        accountId: account2.id,
        amount: 30,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(new DeleteTransactionCommand(tx.id, organizationId))

    // All transactions should be gone
    const list = await queryBus.execute(
      new ListTransactionsQuery(organizationId, "UAH", { page: 1, limit: 100 })
    )
    expect(list.data).toHaveLength(0)

    // Balances restored
    const acc1 = await queryBus.execute(new GetAccountQuery(accountId, organizationId, userId))
    expect(acc1.balance).toBe(10000)

    const acc2 = await queryBus.execute(
      new GetAccountQuery(account2.id, organizationId, userId)
    )
    expect(acc2.balance).toBe(5000)
  })
})
