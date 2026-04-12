import { test, expect } from "@playwright/test"
import {
  createUserData,
  generateInviteLink,
  signupAndLogin,
} from "../../shared/factories"

test.describe("Invite flow", () => {
  test("GET /auth/invite returns org name for valid code", async ({
    request,
  }) => {
    await signupAndLogin(request)
    const { inviteCode } = await generateInviteLink(request)

    const res = await request.get(`/auth/invite?code=${inviteCode}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.organizationName).toBeDefined()
  })

  test("GET /auth/invite returns 404 for invalid code", async ({
    request,
  }) => {
    const res = await request.get("/auth/invite?code=invalidcode123")
    expect(res.status()).toBe(404)
  })

  test("POST /auth/invite-code requires authentication", async ({
    request,
  }) => {
    const res = await request.post("/auth/invite-code")
    expect(res.status()).toBe(401)
  })

  test("signup with valid invite code adds user to org", async ({
    request,
  }) => {
    await signupAndLogin(request)
    const { inviteCode } = await generateInviteLink(request)

    // Signup new user with invite code
    const newUser = createUserData()
    const signupRes = await request.post("/auth/signup", {
      data: { ...newUser, inviteCode },
    })
    expect(signupRes.status()).toBe(201)

    // Login as new user and check they can see members
    const loginRes = await request.post("/auth/login", {
      data: { email: newUser.email, password: newUser.password },
    })
    expect(loginRes.status()).toBe(200)

    const membersRes = await request.get("/users/members")
    expect(membersRes.status()).toBe(200)
    const members = await membersRes.json()
    expect(members.length).toBe(2) // owner + invited
  })

  test("signup with invalid invite code returns 201 (no leak)", async ({
    request,
  }) => {
    const user = createUserData()
    const res = await request.post("/auth/signup", {
      data: { ...user, inviteCode: "invalidcode123" },
    })
    expect(res.status()).toBe(201)
  })
})
