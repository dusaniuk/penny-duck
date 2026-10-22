import { describe, expect, it } from "bun:test"
import { isProduction } from "@workspace/env/api"
import { authOptions } from "./auth"

describe("production flag", () => {
  it("isProduction is false outside a production build", () => {
    expect(isProduction).toBe(false)
  })

  it("auth options keep sign-up open in tests", () => {
    expect(authOptions.emailAndPassword.disableSignUp).toBe(false)
  })
})
