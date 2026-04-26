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
import { SetDefaultAccountCommand } from "./commands/set-default-account.command"
import { ClearDefaultAccountCommand } from "./commands/clear-default-account.command"
import { GenerateInviteCodeCommand } from "../auth/commands/generate-invite-code.command"
import { GetAccountsQuery } from "./queries/get-accounts.query"
import { GetAccountQuery } from "./queries/get-account.query"
import { CreateTransactionCommand } from "../transactions/commands/create-transaction.command"

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
})

describe("Accounts", () => {
  it("creates an account with initial balance", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Main Bank", "bank", "UAH", 1000)
    )

    expect(account.name).toBe("Main Bank")
    expect(account.type).toBe("bank")
    expect(account.currency).toBe("UAH")
    expect(account.balance).toBe(1000)
    expect(account.id).toBeDefined()
  })

  it("defaults balance to 0", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "cash", "USD")
    )

    expect(account.balance).toBe(0)
  })

  it("lists accounts for user", async () => {
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH")
    )
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Cash", "cash", "USD")
    )

    const accounts = await queryBus.execute(new GetAccountsQuery(organizationId, userId))

    expect(accounts).toHaveLength(2)
  })

  it("gets a single account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 500)
    )

    const account = await queryBus.execute(
      new GetAccountQuery(created.id, organizationId, userId)
    )

    expect(account.id).toBe(created.id)
    expect(account.name).toBe("Bank")
    expect(account.balance).toBe(500)
  })

  it("updates an account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Old Name", "bank", "UAH")
    )

    const updated = await commandBus.execute(
      new UpdateAccountCommand(created.id, organizationId, userId, "New Name", "cash")
    )

    expect(updated.name).toBe("New Name")
    expect(updated.type).toBe("cash")
  })

  it("deletes an account", async () => {
    const created = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "To Delete", "bank", "UAH")
    )

    await commandBus.execute(new DeleteAccountCommand(created.id, organizationId, userId))

    const accounts = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
    expect(accounts).toHaveLength(0)
  })

  it("rejects deleting account with transactions", async () => {
    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 1000)
    )

    const categories = await queryBus.execute(
      new (
        await import("../categories/queries/get-categories.query")
      ).GetCategoriesQuery(organizationId)
    )

    await commandBus.execute(
      new CreateTransactionCommand({
        organizationId,
        accountId: account.id,
        type: "expense",
        amount: 50,
        categoryId: categories[0].id,
        date: new Date(),
        madeById: userId,
      })
    )

    await expect(
      commandBus.execute(new DeleteAccountCommand(account.id, organizationId, userId))
    ).rejects.toThrow()
  })

  it("isolates accounts between users", async () => {
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "User1 Bank", "bank", "UAH")
    )

    const otherUser = await signupUser()
    const otherOrgId = otherUser.accessToken.organizationId
    const otherUserId = otherUser.accessToken.sub
    await commandBus.execute(
      new CreateAccountCommand(otherOrgId, otherUserId, "User2 Bank", "bank", "USD")
    )

    const user1Accounts = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
    const user2Accounts = await queryBus.execute(
      new GetAccountsQuery(otherOrgId, otherUserId)
    )

    expect(user1Accounts).toHaveLength(1)
    expect(user2Accounts).toHaveLength(1)
    expect(user1Accounts[0].name).toBe("User1 Bank")
    expect(user2Accounts[0].name).toBe("User2 Bank")
  })

  describe("default account", () => {
    it("marks an account as the default for the current user", async () => {
      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      const b = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank B", "bank", "UAH")
      )

      await commandBus.execute(
        new SetDefaultAccountCommand(userId, organizationId, a.id)
      )

      const list = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
      const aRow = list.find((x: { id: string }) => x.id === a.id)!
      const bRow = list.find((x: { id: string }) => x.id === b.id)!
      expect(aRow.isDefault).toBe(true)
      expect(bRow.isDefault).toBe(false)
    })

    it("replaces the previous default when set on a different account", async () => {
      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      const b = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank B", "bank", "UAH")
      )

      await commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, a.id))
      await commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, b.id))

      const list = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
      expect(list.find((x: { id: string }) => x.id === a.id)!.isDefault).toBe(false)
      expect(list.find((x: { id: string }) => x.id === b.id)!.isDefault).toBe(true)
    })

    it("rejects setting default for an account in another org", async () => {
      const second = await signupUser()
      const otherOrgId = second.accessToken.organizationId
      const otherUserId = second.accessToken.sub
      const foreign = await commandBus.execute(
        new CreateAccountCommand(otherOrgId, otherUserId, "Foreign", "bank", "USD")
      )

      await expect(
        commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, foreign.id))
      ).rejects.toThrow("Account not found")
    })

    it("clears the default for the current user", async () => {
      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      await commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, a.id))

      await commandBus.execute(new ClearDefaultAccountCommand(userId, organizationId))

      const list = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
      expect(list.find((x: { id: string }) => x.id === a.id)!.isDefault).toBe(false)
    })

    it("clearing when no default is set is a no-op", async () => {
      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      await expect(
        commandBus.execute(new ClearDefaultAccountCommand(userId, organizationId))
      ).resolves.toBeUndefined()

      const list = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
      expect(list.find((x: { id: string }) => x.id === a.id)!.isDefault).toBe(false)
    })

    it("clears default when the default account is deleted", async () => {
      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      const b = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank B", "bank", "UAH")
      )
      await commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, a.id))

      await commandBus.execute(new DeleteAccountCommand(a.id, organizationId, userId))

      const list = await queryBus.execute(new GetAccountsQuery(organizationId, userId))
      expect(list.find((x: { id: string }) => x.id === a.id)).toBeUndefined()
      expect(list.find((x: { id: string }) => x.id === b.id)!.isDefault).toBe(false)
    })

    it("two users in the same org each see their own default", async () => {
      const { inviteCode } = await commandBus.execute(
        new GenerateInviteCodeCommand(userId, organizationId)
      )
      const second = await signupUser({ inviteCode })
      const secondUserId = second.accessToken.sub
      expect(second.accessToken.organizationId).toBe(organizationId)

      const a = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank A", "bank", "UAH")
      )
      const b = await commandBus.execute(
        new CreateAccountCommand(organizationId, userId, "Bank B", "bank", "UAH")
      )

      await commandBus.execute(new SetDefaultAccountCommand(userId, organizationId, a.id))
      await commandBus.execute(
        new SetDefaultAccountCommand(secondUserId, organizationId, b.id)
      )

      const userOneList = await queryBus.execute(
        new GetAccountsQuery(organizationId, userId)
      )
      const userTwoList = await queryBus.execute(
        new GetAccountsQuery(organizationId, secondUserId)
      )

      expect(userOneList.find((x: { id: string }) => x.id === a.id)!.isDefault).toBe(true)
      expect(userOneList.find((x: { id: string }) => x.id === b.id)!.isDefault).toBe(false)
      expect(userTwoList.find((x: { id: string }) => x.id === a.id)!.isDefault).toBe(false)
      expect(userTwoList.find((x: { id: string }) => x.id === b.id)!.isDefault).toBe(true)
    })
  })
})
