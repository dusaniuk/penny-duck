import { beforeEach, describe, expect, it } from "bun:test"
import { honoApp } from "@/app"
import { signupUser, truncateAll } from "@/test/setup"

async function createInvite(cookie: string) {
  const res = await honoApp.request("/invites", {
    method: "POST",
    headers: { cookie },
  })
  return {
    res,
    body: (await res.json()) as { inviteCode: string; inviteUrl: string },
  }
}

describe("invites", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("lets the owner generate a stable invite link", async () => {
    const owner = await signupUser()

    const first = await createInvite(owner.cookie)
    const second = await createInvite(owner.cookie)

    expect(first.res.status).toBe(200)
    expect(first.body.inviteUrl).toContain(
      `/invite?code=${first.body.inviteCode}`
    )
    expect(second.body.inviteCode).toBe(first.body.inviteCode)
  })

  it("forbids members from generating invite links", async () => {
    const owner = await signupUser()
    const { body } = await createInvite(owner.cookie)
    const member = await signupUser({ inviteCode: body.inviteCode })

    const res = await honoApp.request("/invites", {
      method: "POST",
      headers: { cookie: member.cookie },
    })
    expect(res.status).toBe(403)
  })

  it("requires authentication to generate", async () => {
    const res = await honoApp.request("/invites", { method: "POST" })
    expect(res.status).toBe(401)
  })

  it("looks up the org name for a valid code", async () => {
    const owner = await signupUser({ name: "Olga" })
    const { body } = await createInvite(owner.cookie)

    const res = await honoApp.request(`/invites/${body.inviteCode}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizationName: "Olga's Space" })
  })

  it("returns 404 for an unknown code", async () => {
    const res = await honoApp.request("/invites/no-such-code")
    expect(res.status).toBe(404)
  })
})
