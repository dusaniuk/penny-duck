import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import {
  createUserData,
  generateInviteLink,
  signupAndLogin,
} from "../../shared/factories"

test.describe("Invite flow", () => {
  test("GET /invites/:code returns org name for valid code", async ({
    request,
  }) => {
    await signupAndLogin(request)
    const { inviteCode } = await generateInviteLink(request)

    const res = await request.get(`/invites/${inviteCode}`)
    expect(res.status()).toBe(200)
    expect((await res.json()).organizationName).toBeDefined()
  })

  test("GET /invites/:code returns 404 for invalid code", async ({
    request,
  }) => {
    const res = await request.get("/invites/invalidcode123")
    expect(res.status()).toBe(404)
  })

  test("POST /invites requires authentication", async ({ request }) => {
    const res = await request.post("/invites")
    expect(res.status()).toBe(401)
  })

  test("sign-up with a valid invite code joins the org", async ({
    request,
    playwright,
  }) => {
    await signupAndLogin(request)
    const { inviteCode } = await generateInviteLink(request)

    const invitedCtx = await playwright.request.newContext({
      baseURL: env.API_BASE_URL,
      extraHTTPHeaders: { Origin: env.WEB_BASE_URL },
    })
    const signupRes = await invitedCtx.post("/auth/sign-up/email", {
      data: { ...createUserData(), inviteCode },
    })
    expect(signupRes.status()).toBe(200)

    const members = await (await invitedCtx.get("/users/members")).json()
    expect(members.length).toBe(2)
    await invitedCtx.dispose()
  })

  test("sign-up with an invalid invite code is rejected", async ({
    request,
  }) => {
    const res = await request.post("/auth/sign-up/email", {
      data: { ...createUserData(), inviteCode: "invalidcode123" },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe("INVALID_INVITE")
  })
})
