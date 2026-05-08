import { describe, it, expect, vi } from "vitest"
import * as bcrypt from "bcrypt"
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  NotOrgOwnerError,
  WeakPasswordError,
  generateInviteCode,
  getInvite,
  login,
  logout,
  rotateRefreshToken,
  signup,
} from "./auth"

const PASSWORD = "correct-horse-battery-staple"
let cachedHash: string | null = null
async function passwordHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcrypt.hash(PASSWORD, 4)
  return cachedHash
}

describe("login", () => {
  it("returns user, payload, and refresh token on success", async () => {
    const hash = await passwordHash()
    const insertRefreshToken = vi.fn().mockResolvedValue(undefined)
    const result = await login("Alice@Example.com  ", PASSWORD, {
      findUserByEmail: vi.fn().mockResolvedValue({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        passwordHash: hash,
      }),
      findOrgByUserId: vi.fn().mockResolvedValue({ id: "o1" }),
      insertRefreshToken,
    })

    expect(result.user).toEqual({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
    })
    expect(result.accessToken).toEqual({
      sub: "u1",
      email: "alice@example.com",
      organizationId: "o1",
    })
    expect(typeof result.refreshToken).toBe("string")
    expect(result.refreshToken.length).toBeGreaterThan(40)

    expect(insertRefreshToken).toHaveBeenCalledOnce()
    const call = insertRefreshToken.mock.calls[0][0]
    expect(call.userId).toBe("u1")
    expect(call.token).toBe(result.refreshToken)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const drift = Math.abs(call.expiresAt.getTime() - (Date.now() + sevenDaysMs))
    expect(drift).toBeLessThan(5000)
  })

  it("normalizes email to lowercase + trim before lookup", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue(null)
    await expect(
      login("  Bob@Example.COM ", PASSWORD, {
        findUserByEmail,
        findOrgByUserId: vi.fn(),
        insertRefreshToken: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(findUserByEmail).toHaveBeenCalledWith("bob@example.com")
  })

  it("throws InvalidCredentialsError when user not found", async () => {
    await expect(
      login("missing@example.com", PASSWORD, {
        findUserByEmail: vi.fn().mockResolvedValue(null),
        findOrgByUserId: vi.fn(),
        insertRefreshToken: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("throws InvalidCredentialsError on wrong password", async () => {
    const hash = await passwordHash()
    await expect(
      login("alice@example.com", "wrong-password", {
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          passwordHash: hash,
        }),
        findOrgByUserId: vi.fn(),
        insertRefreshToken: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("throws InvalidCredentialsError when user has no org", async () => {
    const hash = await passwordHash()
    await expect(
      login("alice@example.com", PASSWORD, {
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          passwordHash: hash,
        }),
        findOrgByUserId: vi.fn().mockResolvedValue(null),
        insertRefreshToken: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })
})

describe("rotateRefreshToken", () => {
  it("deletes the old token before inserting a new one", async () => {
    const calls: string[] = []
    const deleteRefreshToken = vi.fn().mockImplementation(async () => {
      calls.push("delete")
    })
    const insertRefreshToken = vi.fn().mockImplementation(async () => {
      calls.push("insert")
    })

    await rotateRefreshToken("old-token", {
      findRefreshToken: vi.fn().mockResolvedValue({
        userId: "u1",
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteRefreshToken,
      insertRefreshToken,
      findUserById: vi.fn().mockResolvedValue({ email: "alice@example.com" }),
      findOrgByUserId: vi.fn().mockResolvedValue({ id: "o1" }),
    })

    expect(calls).toEqual(["delete", "insert"])
  })

  it("returns a new payload + refresh token", async () => {
    const result = await rotateRefreshToken("old-token", {
      findRefreshToken: vi.fn().mockResolvedValue({
        userId: "u1",
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteRefreshToken: vi.fn().mockResolvedValue(undefined),
      insertRefreshToken: vi.fn().mockResolvedValue(undefined),
      findUserById: vi.fn().mockResolvedValue({ email: "alice@example.com" }),
      findOrgByUserId: vi.fn().mockResolvedValue({ id: "o1" }),
    })
    expect(result.accessToken).toEqual({
      sub: "u1",
      email: "alice@example.com",
      organizationId: "o1",
    })
    expect(result.refreshToken).not.toBe("old-token")
    expect(result.refreshToken.length).toBeGreaterThan(40)
  })

  it("throws InvalidRefreshTokenError when token is missing", async () => {
    await expect(
      rotateRefreshToken("missing", {
        findRefreshToken: vi.fn().mockResolvedValue(null),
        deleteRefreshToken: vi.fn(),
        insertRefreshToken: vi.fn(),
        findUserById: vi.fn(),
        findOrgByUserId: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when token is expired", async () => {
    await expect(
      rotateRefreshToken("expired", {
        findRefreshToken: vi.fn().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() - 1000),
        }),
        deleteRefreshToken: vi.fn(),
        insertRefreshToken: vi.fn(),
        findUserById: vi.fn(),
        findOrgByUserId: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when user lookup fails", async () => {
    await expect(
      rotateRefreshToken("token", {
        findRefreshToken: vi.fn().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
        deleteRefreshToken: vi.fn().mockResolvedValue(undefined),
        insertRefreshToken: vi.fn().mockResolvedValue(undefined),
        findUserById: vi.fn().mockResolvedValue(null),
        findOrgByUserId: vi.fn(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when org lookup fails", async () => {
    await expect(
      rotateRefreshToken("token", {
        findRefreshToken: vi.fn().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
        deleteRefreshToken: vi.fn().mockResolvedValue(undefined),
        insertRefreshToken: vi.fn().mockResolvedValue(undefined),
        findUserById: vi.fn().mockResolvedValue({ email: "alice@example.com" }),
        findOrgByUserId: vi.fn().mockResolvedValue(null),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })
})

describe("logout", () => {
  it("deletes the refresh token", async () => {
    const deleteRefreshToken = vi.fn().mockResolvedValue(undefined)
    await logout("token", { deleteRefreshToken })
    expect(deleteRefreshToken).toHaveBeenCalledWith("token")
  })
})

describe("signup", () => {
  function buildDeps(
    overrides: Partial<Parameters<typeof signup>[1]> = {}
  ): Parameters<typeof signup>[1] {
    return {
      findUserByEmail: vi.fn().mockResolvedValue(null),
      findOrgByInviteCode: vi.fn().mockResolvedValue(null),
      insertUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", email: "alice@example.com", name: "Alice" }),
      addOrgMember: vi.fn().mockResolvedValue(undefined),
      createOrgWithOwner: vi.fn().mockResolvedValue({ id: "o1" }),
      ...overrides,
    }
  }

  it("returns null when email is already registered (no leak)", async () => {
    const deps = buildDeps({
      findUserByEmail: vi.fn().mockResolvedValue({ id: "existing" }),
    })
    const result = await signup(
      {
        name: "Alice",
        email: "alice@example.com",
        password: PASSWORD,
      },
      deps
    )
    expect(result).toBeNull()
    expect(deps.insertUser).not.toHaveBeenCalled()
    expect(deps.createOrgWithOwner).not.toHaveBeenCalled()
  })

  it("returns null when invite code is invalid (no leak)", async () => {
    const deps = buildDeps({
      findOrgByInviteCode: vi.fn().mockResolvedValue(null),
    })
    const result = await signup(
      {
        name: "Bob",
        email: "bob@example.com",
        password: PASSWORD,
        inviteCode: "bogus",
      },
      deps
    )
    expect(result).toBeNull()
    expect(deps.insertUser).not.toHaveBeenCalled()
  })

  it("throws WeakPasswordError when password is too short", async () => {
    await expect(
      signup(
        { name: "A", email: "a@example.com", password: "short" },
        buildDeps()
      )
    ).rejects.toBeInstanceOf(WeakPasswordError)
  })

  it("throws WeakPasswordError when password is too long", async () => {
    await expect(
      signup(
        {
          name: "A",
          email: "a@example.com",
          password: "x".repeat(129),
        },
        buildDeps()
      )
    ).rejects.toBeInstanceOf(WeakPasswordError)
  })

  it("creates user and a new org when no invite code", async () => {
    const deps = buildDeps()
    const result = await signup(
      { name: "Alice", email: "Alice@example.com  ", password: PASSWORD },
      deps
    )
    expect(result).toEqual({
      userId: "u1",
      email: "alice@example.com",
      organizationId: "o1",
    })
    expect(deps.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alice@example.com",
        name: "Alice",
      })
    )
    expect(deps.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({ agreedToTermsAt: expect.any(Date) })
    )
    expect(deps.createOrgWithOwner).toHaveBeenCalledWith(
      "Alice's Space",
      "u1"
    )
    expect(deps.addOrgMember).not.toHaveBeenCalled()
  })

  it("hashes the password with bcrypt before storing", async () => {
    const deps = buildDeps()
    await signup(
      { name: "Alice", email: "alice@example.com", password: PASSWORD },
      deps
    )
    const insertedHash = (
      deps.insertUser as ReturnType<typeof vi.fn>
    ).mock.calls[0][0].passwordHash
    expect(insertedHash).not.toBe(PASSWORD)
    expect(await bcrypt.compare(PASSWORD, insertedHash)).toBe(true)
  })

  it("joins existing org when invite code is valid", async () => {
    const deps = buildDeps({
      findOrgByInviteCode: vi.fn().mockResolvedValue({ id: "invited-org" }),
    })
    const result = await signup(
      {
        name: "Bob",
        email: "bob@example.com",
        password: PASSWORD,
        inviteCode: "abc",
      },
      deps
    )
    expect(result?.organizationId).toBe("invited-org")
    expect(deps.addOrgMember).toHaveBeenCalledWith("invited-org", "u1")
    expect(deps.createOrgWithOwner).not.toHaveBeenCalled()
  })
})

describe("getInvite", () => {
  it("returns the org name when found", async () => {
    const result = await getInvite("code-1", {
      findOrgByInviteCode: vi.fn().mockResolvedValue({ name: "Acme" }),
    })
    expect(result).toEqual({ organizationName: "Acme" })
  })

  it("returns null when not found", async () => {
    const result = await getInvite("nope", {
      findOrgByInviteCode: vi.fn().mockResolvedValue(null),
    })
    expect(result).toBeNull()
  })
})

describe("generateInviteCode", () => {
  it("returns the new invite code for an owner", async () => {
    const setInviteCode = vi.fn().mockResolvedValue("invite-xyz")
    const result = await generateInviteCode("u1", "o1", {
      getMemberRole: vi.fn().mockResolvedValue("owner"),
      setInviteCode,
    })
    expect(result).toBe("invite-xyz")
    expect(setInviteCode).toHaveBeenCalledWith("o1")
  })

  it("throws NotOrgOwnerError for a non-owner member", async () => {
    await expect(
      generateInviteCode("u1", "o1", {
        getMemberRole: vi.fn().mockResolvedValue("member"),
        setInviteCode: vi.fn(),
      })
    ).rejects.toBeInstanceOf(NotOrgOwnerError)
  })

  it("throws NotOrgOwnerError for a non-member", async () => {
    await expect(
      generateInviteCode("u1", "o1", {
        getMemberRole: vi.fn().mockResolvedValue(null),
        setInviteCode: vi.fn(),
      })
    ).rejects.toBeInstanceOf(NotOrgOwnerError)
  })
})
