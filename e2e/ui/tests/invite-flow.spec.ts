import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData, signupAndLoginViaPage } from "../../shared/factories"

test.describe("Invite flow UI", () => {
  test("shows invalid invite link for bad code", async ({ page }) => {
    await page.goto("/invite?code=boguscode123")

    await expect(page.getByText("Invalid invite link")).toBeVisible()
    await expect(page.getByRole("link", { name: "Go to signup" })).toBeVisible()
  })

  test("invite page shows org name and signup form", async ({
    page,
    request,
  }) => {
    const owner = createUserData()
    await request.post("/api/auth/sign-up/email", {
      data: owner,
      headers: { Origin: env.WEB_BASE_URL },
    })
    const inviteRes = await request.post("/api/invites", {
      headers: { Origin: env.WEB_BASE_URL },
    })
    const { inviteCode } = await inviteRes.json()

    await page.goto(`/invite?code=${inviteCode}`)

    await expect(page.getByText("You've been invited!")).toBeVisible()
    await expect(page.getByLabel("Name")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
  })

  test("can sign up via invite and land on the dashboard", async ({
    page,
    request,
  }) => {
    const owner = createUserData()
    await request.post("/api/auth/sign-up/email", {
      data: owner,
      headers: { Origin: env.WEB_BASE_URL },
    })
    const inviteRes = await request.post("/api/invites", {
      headers: { Origin: env.WEB_BASE_URL },
    })
    const { inviteCode } = await inviteRes.json()

    const invitedUser = createUserData()
    await page.goto(`/invite?code=${inviteCode}`)

    await expect(page.getByText("You've been invited!")).toBeVisible()
    await page.getByLabel("Name").fill(invitedUser.name)
    await page.getByLabel("Email").fill(invitedUser.email)
    await page.getByLabel("Password").fill(invitedUser.password)
    await page.getByRole("button", { name: /Join/ }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("owner sees invite button on members page", async ({ page }) => {
    await signupAndLoginViaPage(page)
    await page.goto("/settings/members")

    await expect(page.getByRole("button", { name: "Invite" })).toBeVisible()
  })
})
