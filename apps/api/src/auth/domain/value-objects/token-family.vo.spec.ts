import { describe, expect, it } from "vitest"
import { TokenFamily } from "./token-family.vo"

describe("TokenFamily", () => {
  it("creates a new family with a generated id", () => {
    const family = TokenFamily.create()
    expect(family.value).toBeDefined()
    expect(family.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it("reconstitutes from an existing id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    const family = TokenFamily.fromExisting(id)
    expect(family.value).toBe(id)
  })

  it("generates unique ids", () => {
    const a = TokenFamily.create()
    const b = TokenFamily.create()
    expect(a.value).not.toBe(b.value)
  })
})
