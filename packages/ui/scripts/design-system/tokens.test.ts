import { describe, expect, it } from "vitest"
import { colorTokens, mergeTokens, normalizeColor, themeTokens } from "./tokens"
import type { Tokens } from "./tokens"

const css = `
@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.960 0.003 80);
  --primary: oklch(0.68 0.19 47); /* tangerine */
  --border: oklch(0 0 0 / 0.08);
  --radius: 0.5rem;
  --tx-ink: #BE123C;
  --tx-submit-bg: var(--primary);
}

.dark {
  --background: oklch(0.13 0.005 270);
  --primary: oklch(0.74 0.18 50);
  --border: oklch(1 0 0 / 0.06);
  --tx-ink: #fb7185;
  --tx-submit-bg: var(--primary);
}

@theme inline {
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-lg: var(--radius);
  --font-sans: "Instrument Sans Variable", sans-serif;
}
`

describe("normalizeColor", () => {
  it("trims oklch numbers, lowercases hex and turns var() into an alias", () => {
    expect(normalizeColor("oklch(0.650 0.200 25.0)")).toBe("oklch(0.65 0.2 25)")
    expect(normalizeColor("oklch(0 0 0 / 0.08)")).toBe("oklch(0 0 0 / 0.08)")
    expect(normalizeColor("#BE123C")).toBe("#be123c")
    expect(normalizeColor("var(--primary)")).toBe("{primary}")
  })
})

describe("colorTokens", () => {
  it("pairs :root and .dark values, skipping non-colours", () => {
    const tokens = colorTokens(css, [
      ["palette-red", "oklch(0.650 0.200 25.0)"],
    ])
    expect(tokens.map((t) => t.name)).toEqual([
      "background",
      "primary",
      "border",
      "tx-ink",
      "tx-submit-bg",
      "palette-red",
    ])
    expect(tokens[0].value).toEqual({
      light: "oklch(0.96 0.003 80)",
      dark: "oklch(0.13 0.005 270)",
    })
    expect(tokens[1].usage).toBe("tangerine")
    expect(tokens[4].value).toEqual({ light: "{primary}" })
    expect(tokens[5].value).toEqual({ light: "oklch(0.65 0.2 25)" })
  })
})

describe("themeTokens", () => {
  it("resolves radius calc() against --radius and reads font stacks", () => {
    const { radii, families } = themeTokens(css)
    expect(radii.map((r) => [r.name, r.value])).toEqual([
      ["radius-sm", "0.3rem"],
      ["radius-lg", "0.5rem"],
    ])
    expect(families).toEqual({ sans: '"Instrument Sans Variable", sans-serif' })
  })
})

describe("mergeTokens", () => {
  const base: Tokens = {
    name: "Penny Duck",
    version: 1,
    meta: { synced: "2026-01-01", repo: "old" },
    color: {
      themes: [{ id: "light", name: "Light" }],
      tokens: [
        { name: "primary", value: { light: "#f97316" }, usage: "The brand." },
        { name: "gone", value: { light: "#000000" }, usage: "Old." },
      ],
    },
    radius: {
      tokens: [
        { name: "radius-sm", value: "0.4rem", usage: "Chips." },
        { name: "radius-surface", value: "11px", usage: "Tiles." },
      ],
    },
    type: { families: { sans: "Inter", mono: "monospace" }, groups: [] },
    spacing: { tokens: [{ name: "space-1", value: "4px", usage: "Gap." }] },
  }

  const { tokens, changes } = mergeTokens(base, {
    colors: [
      { name: "primary", value: { light: "oklch(0.68 0.19 47)" }, usage: "" },
      { name: "info", value: { light: "oklch(0.53 0.12 240)" }, usage: "blue" },
    ],
    radii: [{ name: "radius-sm", value: "0.3rem", usage: "" }],
    families: { sans: '"Instrument Sans Variable", sans-serif' },
    meta: { synced: "2026-10-18" },
  })

  it("updates values from the code and keeps the base's notes", () => {
    expect(tokens.color.tokens).toEqual([
      {
        name: "primary",
        value: { light: "oklch(0.68 0.19 47)" },
        usage: "The brand.",
      },
      { name: "info", value: { light: "oklch(0.53 0.12 240)" }, usage: "blue" },
    ])
    expect(tokens.radius?.tokens).toEqual([
      { name: "radius-sm", value: "0.3rem", usage: "Chips." },
      { name: "radius-surface", value: "11px", usage: "Tiles." },
    ])
    expect(tokens.type?.families).toEqual({
      sans: '"Instrument Sans Variable", sans-serif',
      mono: "monospace",
    })
    expect(tokens.spacing).toEqual(base.spacing)
    expect(tokens.meta).toEqual({ synced: "2026-10-18", repo: "old" })
  })

  it("reports changed, added and removed tokens", () => {
    expect(changes).toEqual([
      "~ color primary: #f97316 → oklch(0.68 0.19 47)",
      "+ color info: oklch(0.53 0.12 240)",
      "- color gone: no longer in the code",
      "~ radius radius-sm: 0.4rem → 0.3rem",
      '~ font sans: Inter → "Instrument Sans Variable", sans-serif',
    ])
  })

  it("does not mutate the base", () => {
    expect(base.color.tokens[0].value).toEqual({ light: "#f97316" })
  })
})
