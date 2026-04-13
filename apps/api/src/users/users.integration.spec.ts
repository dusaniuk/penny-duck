import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { eq } from "drizzle-orm"
import { type DbClient, users, organizations } from "@workspace/db"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { OrganizationRepository } from "../organizations/organization.repository"
import { GetCurrentUserQuery } from "./queries/get-current-user.query"
import { ExportUserDataQuery } from "./queries/export-user-data.query"
import { UpdateProfileCommand } from "./commands/update-profile.command"
import { DeleteUserAccountCommand } from "./commands/delete-account.command"

let commandBus: CommandBus
let queryBus: QueryBus
let db: DbClient
let orgRepo: OrganizationRepository

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
  db = ctx.db
  orgRepo = ctx.app.get(OrganizationRepository)
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

  it("exports all user data for their organization", async () => {
    const login = await signupUser({
      name: "Export User",
      email: "export@test.com",
    })
    await flushEvents()

    const result = await queryBus.execute(
      new ExportUserDataQuery(login.user.id, login.accessToken.organizationId),
    )

    expect(result.exportedAt).toBeDefined()
    expect(result.user.email).toBe("export@test.com")
    expect(result.organization).toBeDefined()
    expect(result.accounts).toEqual([])
    expect(result.categories).toBeInstanceOf(Array)
    expect(result.transactions).toEqual([])
  })

  it("deletes user account and sole-owned org", async () => {
    const login = await signupUser({ email: "delete-me@test.com" })

    await commandBus.execute(
      new DeleteUserAccountCommand(login.user.id, "delete-me@test.com"),
    )

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, login.user.id))
      .limit(1)

    expect(user).toHaveLength(0)

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, login.accessToken.organizationId))
      .limit(1)

    expect(orgs).toHaveLength(0)
  })

  it("rejects deletion with wrong email", async () => {
    const login = await signupUser({ email: "real@test.com" })

    await expect(
      commandBus.execute(
        new DeleteUserAccountCommand(login.user.id, "wrong@test.com"),
      ),
    ).rejects.toThrow()
  })

  it("removes membership but keeps org when not sole owner", async () => {
    const owner = await signupUser({ email: "owner@test.com" })
    const orgId = owner.accessToken.organizationId

    const inviteCode = await orgRepo.setInviteCode(orgId)
    const member = await signupUser({
      email: "member@test.com",
      inviteCode,
    })

    await commandBus.execute(
      new DeleteUserAccountCommand(member.user.id, "member@test.com"),
    )

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, member.user.id))
      .limit(1)

    expect(user).toHaveLength(0)

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    expect(orgs).toHaveLength(1)
  })
})
