import { beforeEach, describe, expect, it } from "bun:test"
import type { Session } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { signupUser, truncateAll, type TestUser } from "@/test/setup"

async function signIn(user: TestUser, userAgent: string): Promise<string> {
  const res = await honoApp.request("/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  if (res.status !== 200) {
    throw new Error(`signIn failed: ${res.status} ${await res.text()}`)
  }
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

async function list(cookie: string) {
  const res = await honoApp.request("/sessions", { headers: { cookie } })
  return { res, body: (await res.json()) as Session[] }
}

function revoke(cookie: string, id: string) {
  return honoApp.request(`/sessions/${id}`, {
    method: "DELETE",
    headers: { cookie },
  })
}

describe("sessions", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("lists the user's sessions with the current one first", async () => {
    const user = await signupUser()
    const phone = await signIn(user, "PhoneBrowser/1.0")

    const { res, body } = await list(phone)
    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      current: true,
      userAgent: "PhoneBrowser/1.0",
    })
    expect(body[1]?.current).toBe(false)
    expect(body[0]).not.toHaveProperty("token")
  })

  it("does not list other users' sessions", async () => {
    const user = await signupUser()
    await signupUser()

    const { body } = await list(user.cookie)
    expect(body).toHaveLength(1)
  })

  it("revokes another session", async () => {
    const user = await signupUser()
    const phone = await signIn(user, "PhoneBrowser/1.0")
    const { body } = await list(user.cookie)
    const other = body.find((s) => !s.current)!

    expect((await revoke(user.cookie, other.id)).status).toBe(200)
    expect((await list(user.cookie)).body).toHaveLength(1)
    const stale = await honoApp.request("/sessions", {
      headers: {
        cookie: phone.replace(/; ?penny-duck\.session_data=[^;]*/, ""),
      },
    })
    expect(stale.status).toBe(401)
  })

  it("refuses to revoke the current session", async () => {
    const user = await signupUser()
    const { body } = await list(user.cookie)

    const res = await revoke(user.cookie, body[0]!.id)
    expect(res.status).toBe(400)
  })

  it("returns 404 for another user's session", async () => {
    const user = await signupUser()
    const stranger = await signupUser()
    const { body } = await list(stranger.cookie)

    const res = await revoke(user.cookie, body[0]!.id)
    expect(res.status).toBe(404)
    expect((await list(stranger.cookie)).body).toHaveLength(1)
  })

  it("revokes all other sessions and keeps the current one", async () => {
    const user = await signupUser()
    await signIn(user, "PhoneBrowser/1.0")
    await signIn(user, "TabletBrowser/1.0")

    const res = await honoApp.request("/sessions/others", {
      method: "DELETE",
      headers: { cookie: user.cookie },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ revoked: 2 })

    const { body } = await list(user.cookie)
    expect(body).toHaveLength(1)
    expect(body[0]?.current).toBe(true)
  })

  it("requires authentication", async () => {
    const res = await honoApp.request("/sessions")
    expect(res.status).toBe(401)
  })
})
