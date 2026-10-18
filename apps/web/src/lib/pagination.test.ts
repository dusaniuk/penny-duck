import { describe, expect, it } from "vitest"
import { nextPageParam } from "./pagination"

describe("nextPageParam", () => {
  it("returns the next page while rows remain", () => {
    expect(nextPageParam(1, 50, 120)).toBe(2)
    expect(nextPageParam(2, 50, 120)).toBe(3)
  })

  it("stops once every page is loaded", () => {
    expect(nextPageParam(3, 50, 120)).toBeUndefined()
    expect(nextPageParam(2, 50, 100)).toBeUndefined()
  })

  it("stops when there are no rows", () => {
    expect(nextPageParam(1, 50, 0)).toBeUndefined()
  })
})
