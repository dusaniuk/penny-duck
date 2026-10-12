import { describe, expect, it } from "bun:test"
import { honoApp } from "@/app"
import { mapGoogleProfile } from "./google"

describe("mapGoogleProfile", () => {
  it("keeps the name and drops the profile image", () => {
    const result = mapGoogleProfile({ name: "Olga Petrenko" })
    expect(result).toEqual({ name: "Olga Petrenko", image: undefined })
    expect("image" in result).toBe(true)
  })

  it("truncates names longer than 100 characters", () => {
    expect(mapGoogleProfile({ name: "y".repeat(150) }).name).toHaveLength(100)
  })

  it("falls back when Google omits the name", () => {
    expect(mapGoogleProfile({ name: null }).name).toBe("Google user")
  })
})

describe("Google sign-in without credentials", () => {
  it("reports the provider as not configured", async () => {
    const res = await honoApp.request("/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }),
    })
    expect(res.status).toBe(404)
    expect(((await res.json()) as { code: string }).code).toBe(
      "PROVIDER_NOT_FOUND"
    )
  })
})
