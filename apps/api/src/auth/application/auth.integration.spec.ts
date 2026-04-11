import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../../test/setup"
import { SignupCommand } from "./commands/signup.command"
import { LoginCommand } from "./commands/login.command"
import { RefreshTokensCommand } from "./commands/refresh-tokens.command"
import { LogoutCommand } from "./commands/logout.command"
import { GetCurrentUserQuery } from "./queries/get-current-user.query"
import { GetCategoriesQuery } from "../../categories/queries/get-categories.query"
import { InvalidCredentialsError } from "../domain/errors/auth.errors"

let commandBus: CommandBus
let queryBus: QueryBus

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
})

afterAll(() => closeTestApp())
beforeEach(async () => {
  await flushEvents() // drain async event handlers from previous test
  await truncateAll()
})

describe("Auth", () => {
  it("signs up and returns a generic success message", async () => {
    const result = await commandBus.execute(
      new SignupCommand("John Doe", "john@example.com", "securePassword123")
    )

    expect(result.message).toBe("Account created successfully")
  })

  it("signup with existing email returns the same success message", async () => {
    await commandBus.execute(
      new SignupCommand("User 1", "dupe@example.com", "password12345678")
    )

    const result = await commandBus.execute(
      new SignupCommand("User 2", "dupe@example.com", "password12345678")
    )

    expect(result.message).toBe("Account created successfully")
  })

  it("signup seeds default categories via event", async () => {
    const result = await signupUser()
    await flushEvents()

    const categories = await queryBus.execute(
      new GetCategoriesQuery(result.accessToken.organizationId)
    )

    expect(categories.length).toBeGreaterThan(0)
  })

  it("signs up then logs in with correct credentials", async () => {
    await commandBus.execute(
      new SignupCommand("User", "login@example.com", "myPassword12345")
    )

    const result = await commandBus.execute(
      new LoginCommand("login@example.com", "myPassword12345")
    )

    expect(result.user.email).toBe("login@example.com")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it("rejects login with wrong password", async () => {
    await commandBus.execute(
      new SignupCommand("User", "wrong@example.com", "correctPassword1")
    )

    await expect(
      commandBus.execute(
        new LoginCommand("wrong@example.com", "wrongPassword1")
      )
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it("rejects login for non-existent user", async () => {
    await expect(
      commandBus.execute(new LoginCommand("noone@example.com", "password12345"))
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it("refreshes tokens", async () => {
    const login = await signupUser()

    const result = await commandBus.execute(
      new RefreshTokensCommand(login.refreshToken)
    )

    expect(result.accessToken.sub).toBe(login.user.id)
    expect(result.refreshToken).toBeDefined()
    expect(result.refreshToken).not.toBe(login.refreshToken)
  })

  it("rejects reused refresh token", async () => {
    const login = await signupUser()
    const oldToken = login.refreshToken

    // Use the token once (rotates it)
    await commandBus.execute(new RefreshTokensCommand(oldToken))

    // Try to use the old token again
    await expect(
      commandBus.execute(new RefreshTokensCommand(oldToken))
    ).rejects.toThrow()
  })

  it("logs out and invalidates refresh token", async () => {
    const login = await signupUser()

    // Rotate the token first so we have a fresh one to test against
    const refreshed = await commandBus.execute(
      new RefreshTokensCommand(login.refreshToken)
    )

    await commandBus.execute(new LogoutCommand(refreshed.refreshToken))

    // After logout, the token family is revoked — any token in that family fails
    await expect(
      commandBus.execute(new RefreshTokensCommand(refreshed.refreshToken))
    ).rejects.toThrow()
  })

  it("rejects concurrent refresh with the same token (race condition)", async () => {
    const login = await signupUser()

    const results = await Promise.allSettled([
      commandBus.execute(new RefreshTokensCommand(login.refreshToken)),
      commandBus.execute(new RefreshTokensCommand(login.refreshToken)),
    ])

    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
  })

  it("gets current user", async () => {
    const login = await signupUser()

    const user = await queryBus.execute(
      new GetCurrentUserQuery(login.user.id, login.user.email)
    )

    expect(user.id).toBe(login.user.id)
    expect(user.email).toBe(login.user.email)
  })
})
