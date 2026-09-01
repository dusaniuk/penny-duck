import { describe, it, expect, mock } from "bun:test"
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
  if (!cachedHash) {
    cachedHash = await Bun.password.hash(PASSWORD, {
      algorithm: "bcrypt",
      cost: 4,
    })
  }
  return cachedHash
}

describe("login", () => {
  it("returns user, payload, and refresh token on success", async () => {
    const hash = await passwordHash()
    const insertRefreshToken = mock().mockResolvedValue(undefined)
    const result = await login("Alice@Example.com  ", PASSWORD, {
      findUserByEmail: mock().mockResolvedValue({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        passwordHash: hash,
      }),
      findOrgByUserId: mock().mockResolvedValue({ id: "o1" }),
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

    expect(insertRefreshToken).toHaveBeenCalledTimes(1)
    const call = insertRefreshToken.mock.calls[0][0]
    expect(call.userId).toBe("u1")
    expect(call.token).toBe(result.refreshToken)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const drift = Math.abs(
      call.expiresAt.getTime() - (Date.now() + sevenDaysMs)
    )
    expect(drift).toBeLessThan(5000)
  })

  it("normalizes email to lowercase + trim before lookup", async () => {
    const findUserByEmail = mock().mockResolvedValue(null)
    await expect(
      login("  Bob@Example.COM ", PASSWORD, {
        findUserByEmail,
        findOrgByUserId: mock(),
        insertRefreshToken: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(findUserByEmail).toHaveBeenCalledWith("bob@example.com")
  })

  it("throws InvalidCredentialsError when user not found", async () => {
    await expect(
      login("missing@example.com", PASSWORD, {
        findUserByEmail: mock().mockResolvedValue(null),
        findOrgByUserId: mock(),
        insertRefreshToken: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("throws InvalidCredentialsError on wrong password", async () => {
    const hash = await passwordHash()
    await expect(
      login("alice@example.com", "wrong-password", {
        findUserByEmail: mock().mockResolvedValue({
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          passwordHash: hash,
        }),
        findOrgByUserId: mock(),
        insertRefreshToken: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("throws InvalidCredentialsError when user has no org", async () => {
    const hash = await passwordHash()
    await expect(
      login("alice@example.com", PASSWORD, {
        findUserByEmail: mock().mockResolvedValue({
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          passwordHash: hash,
        }),
        findOrgByUserId: mock().mockResolvedValue(null),
        insertRefreshToken: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })
})

describe("rotateRefreshToken", () => {
  it("deletes the old token before inserting a new one", async () => {
    const calls: string[] = []
    const deleteRefreshToken = mock().mockImplementation(async () => {
      calls.push("delete")
    })
    const insertRefreshToken = mock().mockImplementation(async () => {
      calls.push("insert")
    })

    await rotateRefreshToken("old-token", {
      findRefreshToken: mock().mockResolvedValue({
        userId: "u1",
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteRefreshToken,
      insertRefreshToken,
      findUserById: mock().mockResolvedValue({ email: "alice@example.com" }),
      findOrgByUserId: mock().mockResolvedValue({ id: "o1" }),
    })

    expect(calls).toEqual(["delete", "insert"])
  })

  it("returns a new payload + refresh token", async () => {
    const result = await rotateRefreshToken("old-token", {
      findRefreshToken: mock().mockResolvedValue({
        userId: "u1",
        expiresAt: new Date(Date.now() + 60_000),
      }),
      deleteRefreshToken: mock().mockResolvedValue(undefined),
      insertRefreshToken: mock().mockResolvedValue(undefined),
      findUserById: mock().mockResolvedValue({ email: "alice@example.com" }),
      findOrgByUserId: mock().mockResolvedValue({ id: "o1" }),
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
        findRefreshToken: mock().mockResolvedValue(null),
        deleteRefreshToken: mock(),
        insertRefreshToken: mock(),
        findUserById: mock(),
        findOrgByUserId: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when token is expired", async () => {
    await expect(
      rotateRefreshToken("expired", {
        findRefreshToken: mock().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() - 1000),
        }),
        deleteRefreshToken: mock(),
        insertRefreshToken: mock(),
        findUserById: mock(),
        findOrgByUserId: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when user lookup fails", async () => {
    await expect(
      rotateRefreshToken("token", {
        findRefreshToken: mock().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
        deleteRefreshToken: mock().mockResolvedValue(undefined),
        insertRefreshToken: mock().mockResolvedValue(undefined),
        findUserById: mock().mockResolvedValue(null),
        findOrgByUserId: mock(),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })

  it("throws InvalidRefreshTokenError when org lookup fails", async () => {
    await expect(
      rotateRefreshToken("token", {
        findRefreshToken: mock().mockResolvedValue({
          userId: "u1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
        deleteRefreshToken: mock().mockResolvedValue(undefined),
        insertRefreshToken: mock().mockResolvedValue(undefined),
        findUserById: mock().mockResolvedValue({ email: "alice@example.com" }),
        findOrgByUserId: mock().mockResolvedValue(null),
      })
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError)
  })
})

describe("logout", () => {
  it("deletes the refresh token", async () => {
    const deleteRefreshToken = mock().mockResolvedValue(undefined)
    await logout("token", { deleteRefreshToken })
    expect(deleteRefreshToken).toHaveBeenCalledWith("token")
  })
})

describe("signup", () => {
  function buildDeps(
    overrides: Partial<Parameters<typeof signup>[1]> = {}
  ): Parameters<typeof signup>[1] {
    return {
      findUserByEmail: mock().mockResolvedValue(null),
      findOrgByInviteCode: mock().mockResolvedValue(null),
      insertUser: mock().mockResolvedValue({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
      }),
      addOrgMember: mock().mockResolvedValue(undefined),
      createOrgWithOwner: mock().mockResolvedValue({ id: "o1" }),
      ...overrides,
    }
  }

  it("returns null when email is already registered (no leak)", async () => {
    const deps = buildDeps({
      findUserByEmail: mock().mockResolvedValue({ id: "existing" }),
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
      findOrgByInviteCode: mock().mockResolvedValue(null),
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
    expect(deps.createOrgWithOwner).toHaveBeenCalledWith("Alice's Space", "u1")
    expect(deps.addOrgMember).not.toHaveBeenCalled()
  })

  it("hashes the password with bcrypt before storing", async () => {
    const deps = buildDeps()
    await signup(
      { name: "Alice", email: "alice@example.com", password: PASSWORD },
      deps
    )
    const insertedHash = (deps.insertUser as ReturnType<typeof mock>).mock
      .calls[0][0].passwordHash
    expect(insertedHash).not.toBe(PASSWORD)
    expect(await Bun.password.verify(PASSWORD, insertedHash)).toBe(true)
  })

  it("joins existing org when invite code is valid", async () => {
    const deps = buildDeps({
      findOrgByInviteCode: mock().mockResolvedValue({ id: "invited-org" }),
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
      findOrgByInviteCode: mock().mockResolvedValue({ name: "Acme" }),
    })
    expect(result).toEqual({ organizationName: "Acme" })
  })

  it("returns null when not found", async () => {
    const result = await getInvite("nope", {
      findOrgByInviteCode: mock().mockResolvedValue(null),
    })
    expect(result).toBeNull()
  })
})

describe("generateInviteCode", () => {
  it("returns the new invite code for an owner", async () => {
    const setInviteCode = mock().mockResolvedValue("invite-xyz")
    const result = await generateInviteCode("u1", "o1", {
      getMemberRole: mock().mockResolvedValue("owner"),
      setInviteCode,
    })
    expect(result).toBe("invite-xyz")
    expect(setInviteCode).toHaveBeenCalledWith("o1")
  })

  it("throws NotOrgOwnerError for a non-owner member", async () => {
    await expect(
      generateInviteCode("u1", "o1", {
        getMemberRole: mock().mockResolvedValue("member"),
        setInviteCode: mock(),
      })
    ).rejects.toBeInstanceOf(NotOrgOwnerError)
  })

  it("throws NotOrgOwnerError for a non-member", async () => {
    await expect(
      generateInviteCode("u1", "o1", {
        getMemberRole: mock().mockResolvedValue(null),
        setInviteCode: mock(),
      })
    ).rejects.toBeInstanceOf(NotOrgOwnerError)
  })
})
