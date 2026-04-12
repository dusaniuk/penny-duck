import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
} from "../test/setup"
import { CreateAccountCommand } from "../accounts/commands/create-account.command"
import { GetAccountQuery } from "../accounts/queries/get-account.query"
import { CreateTransferCommand } from "./commands/create-transfer.command"
import { UpdateTransferCommand } from "./commands/update-transfer.command"
import { DeleteTransferCommand } from "./commands/delete-transfer.command"
import { DeleteTransactionCommand } from "./commands/delete-transaction.command"
import { BadRequestException } from "@nestjs/common"

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

describe("Transfers", () => {
  it("creates a same-currency transfer", async () => {
    const acc1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 1", "bank", "UAH", 5000)
    )
    const acc2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 2", "bank", "UAH", 1000)
    )

    const [outgoing, incoming] = await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date(),
        madeById: userId,
      })
    )

    expect(outgoing.accountId).toBe(acc1.id)
    expect(outgoing.amount).toBe(500)
    expect(outgoing.type).toBe("expense")
    expect(incoming.accountId).toBe(acc2.id)
    expect(incoming.amount).toBe(500)
    expect(incoming.type).toBe("income")
    expect(outgoing.transferId).toBe(incoming.transferId)

    const a1 = await queryBus.execute(new GetAccountQuery(acc1.id, organizationId))
    const a2 = await queryBus.execute(new GetAccountQuery(acc2.id, organizationId))
    expect(a1.balance).toBe(4500)
    expect(a2.balance).toBe(1500)
  })

  it("creates a cross-currency transfer", async () => {
    const usd = await commandBus.execute(
      new CreateAccountCommand(organizationId, "USD", "bank", "USD", 1000)
    )
    const uah = await commandBus.execute(
      new CreateAccountCommand(organizationId, "UAH", "bank", "UAH", 0)
    )

    const [outgoing, incoming] = await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: usd.id,
        toAccountId: uah.id,
        amount: 100,
        date: new Date(),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
        madeById: userId,
      })
    )

    expect(outgoing.amount).toBe(100)
    expect(outgoing.exchangeRate).toBe(41.52)
    expect(incoming.amount).toBe(4152)

    const u = await queryBus.execute(new GetAccountQuery(usd.id, organizationId))
    const h = await queryBus.execute(new GetAccountQuery(uah.id, organizationId))
    expect(u.balance).toBe(900)
    expect(h.balance).toBe(4152)
  })

  it("rejects transfer to same account", async () => {
    const acc = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank", "bank", "UAH", 5000)
    )

    await expect(
      commandBus.execute(
        new CreateTransferCommand({
          organizationId,
          fromAccountId: acc.id,
          toAccountId: acc.id,
          amount: 100,
          date: new Date(),
          madeById: userId,
        })
      )
    ).rejects.toThrow(BadRequestException)
  })

  it("updates a transfer", async () => {
    const acc1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 1", "bank", "UAH", 5000)
    )
    const acc2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 2", "bank", "UAH", 1000)
    )

    const [outgoing] = await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date(),
        madeById: userId,
      })
    )

    const [updatedOut, updatedIn] = await commandBus.execute(
      new UpdateTransferCommand(outgoing.transferId!, organizationId, {
        amount: 300,
        note: "adjusted",
      })
    )

    expect(updatedOut.amount).toBe(300)
    expect(updatedOut.note).toBe("adjusted")
    expect(updatedIn.amount).toBe(300)
    expect(updatedIn.note).toBe("adjusted")
  })

  it("deletes a transfer and restores balances", async () => {
    const acc1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 1", "bank", "UAH", 5000)
    )
    const acc2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 2", "bank", "UAH", 1000)
    )

    const [outgoing] = await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date(),
        madeById: userId,
      })
    )

    await commandBus.execute(
      new DeleteTransferCommand(outgoing.transferId!, organizationId)
    )

    const a1 = await queryBus.execute(new GetAccountQuery(acc1.id, organizationId))
    const a2 = await queryBus.execute(new GetAccountQuery(acc2.id, organizationId))
    expect(a1.balance).toBe(5000)
    expect(a2.balance).toBe(1000)
  })

  it("rejects deleting transfer via regular transaction endpoint", async () => {
    const acc1 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 1", "bank", "UAH", 5000)
    )
    const acc2 = await commandBus.execute(
      new CreateAccountCommand(organizationId, "Bank 2", "bank", "UAH", 1000)
    )

    const [outgoing] = await commandBus.execute(
      new CreateTransferCommand({
        organizationId,
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date(),
        madeById: userId,
      })
    )

    await expect(
      commandBus.execute(new DeleteTransactionCommand(outgoing.id, organizationId))
    ).rejects.toThrow()
  })
})
