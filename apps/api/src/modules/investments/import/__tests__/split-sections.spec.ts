import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "bun:test"

import { splitSections } from "../split-sections"

const FIXTURES = join(__dirname, "..", "fixtures")

describe("splitSections", () => {
  it("single-section CSV (Trades only) → 1 section", () => {
    const csv = readFileSync(join(FIXTURES, "trades-only.csv"), "utf8")
    const sections = splitSections(csv)
    expect(sections).toHaveLength(1)
    expect(sections[0].header[0]).toBe("ClientAccountID")
    expect(sections[0].rows).toHaveLength(1)
  })

  it("two-section CSV → 2 sections with different column counts", () => {
    const csv = readFileSync(join(FIXTURES, "trades-and-dividends.csv"), "utf8")
    const sections = splitSections(csv)
    expect(sections).toHaveLength(2)
    expect(sections[0].header).toHaveLength(85)
    expect(sections[1].header).toHaveLength(46)
    expect(sections[0].rows.length).toBeGreaterThan(0)
    expect(sections[1].rows.length).toBeGreaterThan(0)
  })

  it("empty-sections CSV → 2 sections, 0 rows each", () => {
    const csv = readFileSync(join(FIXTURES, "empty-sections.csv"), "utf8")
    const sections = splitSections(csv)
    expect(sections).toHaveLength(2)
    expect(sections[0].rows).toHaveLength(0)
    expect(sections[1].rows).toHaveLength(0)
  })

  it("throws on malformed CSV with no ClientAccountID header", () => {
    const csv = readFileSync(join(FIXTURES, "malformed.csv"), "utf8")
    expect(() => splitSections(csv)).toThrow(/ClientAccountID/i)
  })
})
