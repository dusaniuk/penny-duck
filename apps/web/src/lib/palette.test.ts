import { describe, expect, it } from "vitest"
import {
  NEUTRAL_COLOR,
  PALETTE_TOKENS,
  categoryColor,
  paletteColor,
  pickRandomUnusedColor,
} from "./palette"
import type { Category } from "@workspace/api-contract"

const parent = (id: string, name: string, color: string | null): Category => ({
  id,
  name,
  type: "expense",
  parentId: null,
  icon: null,
  color,
  archivedAt: null,
})

const child = (id: string, name: string, parentId: string): Category => ({
  id,
  name,
  type: "expense",
  parentId,
  icon: null,
  color: null,
  archivedAt: null,
})

describe("paletteColor", () => {
  it("returns an oklch() string for a known token", () => {
    expect(paletteColor("blue")).toMatch(/^oklch\(/)
  })
  it("returns NEUTRAL_COLOR for null", () => {
    expect(paletteColor(null)).toBe(NEUTRAL_COLOR)
  })
  it("returns NEUTRAL_COLOR for an unknown token", () => {
    expect(paletteColor("not-a-color")).toBe(NEUTRAL_COLOR)
  })
})

describe("categoryColor", () => {
  it("returns the parent's palette color for a top-level category", () => {
    const p = parent("p1", "Food", "red")
    expect(categoryColor(p, [p])).toBe(paletteColor("red"))
  })

  it("returns NEUTRAL_COLOR for a top-level category with null color", () => {
    const p = parent("p1", "Food", null)
    expect(categoryColor(p, [p])).toBe(NEUTRAL_COLOR)
  })

  it("derives distinct shades for siblings sorted by name", () => {
    const p = parent("p1", "Food", "blue")
    const c1 = child("c1", "Apples", "p1")
    const c2 = child("c2", "Bananas", "p1")
    const c3 = child("c3", "Coconuts", "p1")
    const c4 = child("c4", "Donuts", "p1")
    const all = [p, c1, c2, c3, c4]
    const colors = [c1, c2, c3, c4].map((c) => categoryColor(c, all))
    expect(new Set(colors).size).toBe(4)
    expect(colors).not.toContain(paletteColor("blue"))
  })

  it("returns NEUTRAL_COLOR for a child whose parent is missing or has no color", () => {
    const orphan = child("c1", "Coffee", "missing-parent")
    expect(categoryColor(orphan, [orphan])).toBe(NEUTRAL_COLOR)

    const p = parent("p1", "Food", null)
    const c = child("c1", "Coffee", "p1")
    expect(categoryColor(c, [p, c])).toBe(NEUTRAL_COLOR)
  })
})

describe("pickRandomUnusedColor", () => {
  it("returns a token from the palette", () => {
    const picked = pickRandomUnusedColor([])
    expect(PALETTE_TOKENS).toContain(picked)
  })

  it("avoids tokens already in use when possible", () => {
    const used = PALETTE_TOKENS.slice(
      0,
      PALETTE_TOKENS.length - 1
    ) as Array<string>
    const picked = pickRandomUnusedColor(used)
    expect(picked).toBe(PALETTE_TOKENS[PALETTE_TOKENS.length - 1])
  })

  it("falls back to fully-random when all tokens are used", () => {
    const picked = pickRandomUnusedColor([...PALETTE_TOKENS])
    expect(PALETTE_TOKENS).toContain(picked)
  })
})
