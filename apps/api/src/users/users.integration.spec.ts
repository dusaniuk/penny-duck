import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { GetCurrentUserQuery } from "./queries/get-current-user.query"
import { UpdateProfileCommand } from "./commands/update-profile.command"

let commandBus: CommandBus
let queryBus: QueryBus

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())
beforeEach(async () => {
  await flushEvents()
  await truncateAll()
})

describe("Users", () => {
  it("gets current user by id", async () => {
    const login = await signupUser({ name: "Jane Doe" })

    const user = await queryBus.execute(
      new GetCurrentUserQuery(login.user.id),
    )

    expect(user.id).toBe(login.user.id)
    expect(user.email).toBe(login.user.email)
    expect(user.name).toBe("Jane Doe")
    expect(user.homeCurrency).toBe("UAH")
  })

  it("updates user name", async () => {
    const login = await signupUser()

    const updated = await commandBus.execute(
      new UpdateProfileCommand(login.user.id, "New Name", undefined),
    )

    expect(updated.name).toBe("New Name")
    expect(updated.id).toBe(login.user.id)
  })

  it("updates home currency", async () => {
    const login = await signupUser()

    const updated = await commandBus.execute(
      new UpdateProfileCommand(login.user.id, undefined, "USD"),
    )

    expect(updated.homeCurrency).toBe("USD")
  })

  it("updates both name and currency", async () => {
    const login = await signupUser()

    const updated = await commandBus.execute(
      new UpdateProfileCommand(login.user.id, "Updated", "EUR"),
    )

    expect(updated.name).toBe("Updated")
    expect(updated.homeCurrency).toBe("EUR")
  })

  it("rejects invalid currency code", async () => {
    const login = await signupUser()

    await expect(
      commandBus.execute(
        new UpdateProfileCommand(login.user.id, undefined, "INVALID"),
      ),
    ).rejects.toThrow()
  })
})
