import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
} from "../test/setup"
import { CreateAccountCommand } from "./commands/create-account.command"
import { UpdateAccountCommand } from "./commands/update-account.command"
import { DeleteAccountCommand } from "./commands/delete-account.command"
import { GetAccountsQuery } from "./queries/get-accounts.query"
import { GetAccountQuery } from "./queries/get-account.query"
import { CreateTransactionCommand } from "../transactions/commands/create-transaction.command"

let commandBus: CommandBus
let queryBus: QueryBus
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
  userId = result.user.id
})

describe("Accounts", () => {
  it("creates an account with initial balance", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(userId, "Main Bank", "bank", "UAH", 1000)
    )

    expect(account.name).toBe("Main Bank")
    expect(account.type).toBe("bank")
    expect(account.currency).toBe("UAH")
    expect(account.balance).toBe(1000)
    expect(account.id).toBeDefined()
  })

  it("defaults balance to 0", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(userId, "Cash", "cash", "USD")
    )

    expect(account.balance).toBe(0)
  })

  it("lists accounts for user", async () => {
    await commandBus.execute(
      new CreateAccountCommand(userId, "Bank", "bank", "UAH")
    )
    await commandBus.execute(
      new CreateAccountCommand(userId, "Cash", "cash", "USD")
    )

    const accounts = await queryBus.execute(new GetAccountsQuery(userId))

    expect(accounts).toHaveLength(2)
  })

  it("gets a single account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(userId, "Bank", "bank", "UAH", 500)
    )

    const account = await queryBus.execute(
      new GetAccountQuery(created.id, userId)
    )

    expect(account.id).toBe(created.id)
    expect(account.name).toBe("Bank")
    expect(account.balance).toBe(500)
  })

  it("updates an account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(userId, "Old Name", "bank", "UAH")
    )

    const updated = await commandBus.execute(
      new UpdateAccountCommand(created.id, userId, "New Name", "cash")
    )

    expect(updated.name).toBe("New Name")
    expect(updated.type).toBe("cash")
  })

  it("deletes an account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(userId, "To Delete", "bank", "UAH")
    )

    await commandBus.execute(new DeleteAccountCommand(created.id, userId))

    const accounts = await queryBus.execute(new GetAccountsQuery(userId))
    expect(accounts).toHaveLength(0)
  })

  it("rejects deleting account with transactions", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(userId, "Bank", "bank", "UAH", 1000)
    )

    const categories = await queryBus.execute(
      new (
        await import("../categories/queries/get-categories.query")
      ).GetCategoriesQuery(userId)
    )

    await commandBus.execute(
      new CreateTransactionCommand({
        userId,
        accountId: account.id,
        type: "expense",
        amount: 50,
        categoryId: categories[0].id,
        date: new Date(),
      })
    )

    await expect(
      commandBus.execute(new DeleteAccountCommand(account.id, userId))
    ).rejects.toThrow()
  })

  it("isolates accounts between users", async () => {
    await commandBus.execute(
      new CreateAccountCommand(userId, "User1 Bank", "bank", "UAH")
    )

    const otherUser = await signupUser()
    await commandBus.execute(
      new CreateAccountCommand(otherUser.user.id, "User2 Bank", "bank", "USD")
    )

    const user1Accounts = await queryBus.execute(new GetAccountsQuery(userId))
    const user2Accounts = await queryBus.execute(
      new GetAccountsQuery(otherUser.user.id)
    )

    expect(user1Accounts).toHaveLength(1)
    expect(user2Accounts).toHaveLength(1)
    expect(user1Accounts[0].name).toBe("User1 Bank")
    expect(user2Accounts[0].name).toBe("User2 Bank")
  })
})
