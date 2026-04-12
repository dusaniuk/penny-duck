import { UnauthorizedException } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  signupUser,
  flushEvents,
} from "../test/setup"
import { SignupCommand } from "./commands/signup.command"
import { LoginCommand } from "./commands/login.command"
import { RefreshTokensCommand } from "./commands/refresh-tokens.command"
import { LogoutCommand } from "./commands/logout.command"
import { GenerateInviteCodeCommand } from "./commands/generate-invite-code.command"
import { GetCategoriesQuery } from "../categories/queries/get-categories.query"
import { GetInviteQuery } from "./queries/get-invite.query"
import { GetMembersQuery } from "../users/queries/get-members.query"
import { OrganizationRepository } from "../organizations/organization.repository"

let commandBus: CommandBus
let queryBus: QueryBus
let orgRepo: OrganizationRepository

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
  queryBus = ctx.queryBus
  orgRepo = ctx.app.get(OrganizationRepository)
})

afterAll(() => closeTestApp())
beforeEach(async () => {
  await flushEvents()
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
    ).rejects.toThrow(UnauthorizedException)
  })

  it("rejects login for non-existent user", async () => {
    await expect(
      commandBus.execute(new LoginCommand("noone@example.com", "password12345"))
    ).rejects.toThrow(UnauthorizedException)
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

  it("rejects refresh with old token after rotation", async () => {
    const login = await signupUser()
    const oldToken = login.refreshToken

    await commandBus.execute(new RefreshTokensCommand(oldToken))

    // Old token was deleted during refresh, so it should fail
    await expect(
      commandBus.execute(new RefreshTokensCommand(oldToken))
    ).rejects.toThrow()
  })

  it("logs out and invalidates refresh token", async () => {
    const login = await signupUser()

    await commandBus.execute(new LogoutCommand(login.refreshToken))

    await expect(
      commandBus.execute(new RefreshTokensCommand(login.refreshToken))
    ).rejects.toThrow()
  })

  describe("Invite flow", () => {
    it("findByInviteCode returns null when no org has that code", async () => {
      const result = await orgRepo.findByInviteCode("nonexistent")
      expect(result).toBeNull()
    })

    it("setInviteCode generates and persists a code", async () => {
      const user = await signupUser()
      const org = await orgRepo.findByUserId(user.accessToken.sub)

      const code = await orgRepo.setInviteCode(org!.id)
      expect(code).toBeDefined()
      expect(code.length).toBeGreaterThan(10)

      const found = await orgRepo.findByInviteCode(code)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(org!.id)
    })

    it("setInviteCode returns existing code if already set", async () => {
      const user = await signupUser()
      const org = await orgRepo.findByUserId(user.accessToken.sub)

      const code1 = await orgRepo.setInviteCode(org!.id)
      const code2 = await orgRepo.setInviteCode(org!.id)
      expect(code1).toBe(code2)
    })

    it("addMember adds a user to an org as member", async () => {
      const owner = await signupUser()
      const org = await orgRepo.findByUserId(owner.accessToken.sub)

      await commandBus.execute(
        new SignupCommand("New User", "newuser@example.com", "password12345678")
      )
      const newUserLogin = await commandBus.execute(
        new LoginCommand("newuser@example.com", "password12345678")
      )

      await orgRepo.addMember(org!.id, newUserLogin.accessToken.sub)

      const members = await queryBus.execute(new GetMembersQuery(org!.id))
      const newMember = members.find(
        (m: { id: string }) => m.id === newUserLogin.accessToken.sub
      )
      expect(newMember).toBeDefined()
      expect(newMember.role).toBe("member")
    })

    it("GetInviteQuery returns org name for valid code", async () => {
      const user = await signupUser()
      const org = await orgRepo.findByUserId(user.accessToken.sub)
      const code = await orgRepo.setInviteCode(org!.id)

      const result = await queryBus.execute(new GetInviteQuery(code))
      expect(result).toEqual({ organizationName: org!.name })
    })

    it("GetInviteQuery returns null for invalid code", async () => {
      const result = await queryBus.execute(new GetInviteQuery("bogus"))
      expect(result).toBeNull()
    })

    it("GenerateInviteCodeCommand generates code for org owner", async () => {
      const user = await signupUser()

      const result = await commandBus.execute(
        new GenerateInviteCodeCommand(
          user.accessToken.sub,
          user.accessToken.organizationId
        )
      )

      expect(result.inviteCode).toBeDefined()
      expect(result.inviteCode.length).toBeGreaterThan(10)
      expect(result.inviteUrl).toContain(result.inviteCode)
    })

    it("GenerateInviteCodeCommand rejects non-owner", async () => {
      const owner = await signupUser()
      const org = await orgRepo.findByUserId(owner.accessToken.sub)

      await commandBus.execute(
        new SignupCommand("Member", "member@example.com", "password12345678")
      )
      const memberLogin = await commandBus.execute(
        new LoginCommand("member@example.com", "password12345678")
      )
      await orgRepo.addMember(org!.id, memberLogin.accessToken.sub)

      await expect(
        commandBus.execute(
          new GenerateInviteCodeCommand(memberLogin.accessToken.sub, org!.id)
        )
      ).rejects.toThrow()
    })

    it("signup with valid invite code adds user to existing org", async () => {
      const owner = await signupUser()
      const org = await orgRepo.findByUserId(owner.accessToken.sub)
      const code = await orgRepo.setInviteCode(org!.id)

      const result = await commandBus.execute(
        new SignupCommand(
          "Invited User",
          "invited@example.com",
          "password12345678",
          code
        )
      )

      expect(result.message).toBe("Account created successfully")

      const login = await commandBus.execute(
        new LoginCommand("invited@example.com", "password12345678")
      )
      expect(login.accessToken.organizationId).toBe(org!.id)
    })

    it("signup with invalid invite code returns generic success", async () => {
      const result = await commandBus.execute(
        new SignupCommand(
          "User",
          "nocode@example.com",
          "password12345678",
          "invalidcode"
        )
      )

      expect(result.message).toBe("Account created successfully")
    })

    it("signup with invite code and existing email returns generic success", async () => {
      const owner = await signupUser()
      const org = await orgRepo.findByUserId(owner.accessToken.sub)
      const code = await orgRepo.setInviteCode(org!.id)

      await commandBus.execute(
        new SignupCommand(
          "Existing",
          "existing@example.com",
          "password12345678"
        )
      )

      const result = await commandBus.execute(
        new SignupCommand(
          "Existing",
          "existing@example.com",
          "password12345678",
          code
        )
      )

      expect(result.message).toBe("Account created successfully")
    })
  })
})
