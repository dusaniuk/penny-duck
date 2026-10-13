import { beforeEach, describe, expect, it } from "bun:test"
import { betterAuth } from "better-auth"
import { authAccounts, users } from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import { truncateAll } from "@/test/setup"
import { authOptions } from "./auth"

function postJson(path: string, body: unknown, headers: HeadersInit = {}) {
  return honoApp.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

async function insertLegacyUser(email: string, password: string) {
  const [user] = await db
    .insert(users)
    .values({ email, name: "Legacy User" })
    .returning()
  await db.insert(authAccounts).values({
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 4,
    }),
  })
  return user
}

describe("better-auth mount", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("signs up through /auth/sign-up/email and sets a session cookie", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "New User",
      email: "new@example.com",
      password: "a-long-password",
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie")).toContain("penny-duck.session_token=")
  })

  it("does not expose Better Auth's /update-user endpoint", async () => {
    const signUp = await postJson("/auth/sign-up/email", {
      name: "New User",
      email: "new@example.com",
      password: "a-long-password",
    })
    const cookie = signUp.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")

    const res = await postJson("/auth/update-user", { name: "x" }, { cookie })

    expect(res.status).toBe(404)
  })

  it("signs in a legacy bcrypt user with differently-cased email", async () => {
    await insertLegacyUser("legacy@example.com", "legacy-password")

    const res = await postJson("/auth/sign-in/email", {
      email: "Legacy@Example.com",
      password: "legacy-password",
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { email: string } }
    expect(body.user.email).toBe("legacy@example.com")
  })

  it("rejects a legacy user's wrong password with 401", async () => {
    await insertLegacyUser("legacy@example.com", "legacy-password")

    const res = await postJson("/auth/sign-in/email", {
      email: "legacy@example.com",
      password: "not-the-password",
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("INVALID_EMAIL_OR_PASSWORD")
  })

  it("returns 422 for a duplicate email", async () => {
    const body = {
      name: "Dup",
      email: "dup@example.com",
      password: "a-long-password",
    }
    await postJson("/auth/sign-up/email", body)

    const res = await postJson("/auth/sign-up/email", body)

    expect(res.status).toBe(422)
  })

  it("rate-limits the sixth sign-in attempt in a minute", async () => {
    const limited = betterAuth({
      ...authOptions,
      rateLimit: { ...authOptions.rateLimit, enabled: true },
    })
    const attempt = () =>
      limited.handler(
        new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({
            email: "nobody@example.com",
            password: "whatever-password",
          }),
        })
      )

    for (let i = 0; i < 5; i++) {
      expect((await attempt()).status).toBe(401)
    }
    expect((await attempt()).status).toBe(429)
  })

  it("keeps sign-up open outside production", () => {
    expect(authOptions.emailAndPassword.disableSignUp).toBe(false)
  })

  describe("with sign-up closed", () => {
    const closed = betterAuth({
      ...authOptions,
      emailAndPassword: {
        ...authOptions.emailAndPassword,
        disableSignUp: true,
      },
    })
    const post = (path: string, body: unknown) =>
      closed.handler(
        new Request(`http://localhost/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      )

    it("rejects email sign-up without creating a user", async () => {
      const res = await post("/sign-up/email", {
        name: "Stranger",
        email: "stranger@example.com",
        password: "a-long-password",
      })

      expect(res.status).toBe(400)
      expect(((await res.json()) as { code: string }).code).toBe(
        "EMAIL_PASSWORD_SIGN_UP_DISABLED"
      )
      expect(await db.select().from(users)).toHaveLength(0)
    })

    it("still signs in existing users", async () => {
      await insertLegacyUser("friend@example.com", "friend-password")

      const res = await post("/sign-in/email", {
        email: "friend@example.com",
        password: "friend-password",
      })

      expect(res.status).toBe(200)
    })
  })
})
