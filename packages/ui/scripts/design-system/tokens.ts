// Refreshes the artifact's tokens.json from the code. Values come from
// globals.css and palette.ts; everything a person wrote on the artifact
// (usage notes, type styles, spacing, sizes) is kept from the base file.

export type ThemeValue = { light: string; dark?: string }
export type ColorToken = { name: string; value: ThemeValue; usage: string }
export type Token = { name: string; value: string; usage: string }

export type Tokens = {
  name: string
  version: number
  meta?: Record<string, unknown>
  color: {
    themes: Array<{ id: string; name: string }>
    tokens: Array<ColorToken>
  }
  radius?: { note?: string; tokens: Array<Token> }
  type?: { families?: Record<string, string> } & Record<string, unknown>
} & Record<string, unknown>

type Declaration = { value: string; comment: string }

export function findBlock(css: string, selector: string) {
  const start = css.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`globals.css has no ${selector} block`)
  let depth = 0
  let end = css.indexOf("{", start)
  for (; end < css.length; end++) {
    if (css[end] === "{") depth++
    else if (css[end] === "}" && --depth === 0) break
  }
  return { start, end: end + 1, body: css.slice(start, end + 1) }
}

function declarations(block: string): Map<string, Declaration> {
  const out = new Map<string, Declaration>()
  for (const [, name, value, rest] of block.matchAll(
    /--([\w-]+):\s*([^;]+);([^\n]*)/g
  )) {
    const comment = rest.match(/\/\*\s*(.*?)\s*\*\//)?.[1] ?? ""
    out.set(name, { value: value.trim(), comment })
  }
  return out
}

const trimNumber = (n: string) => String(Number(n))

export function normalizeColor(value: string): string {
  const alias = value.match(/^var\(--([\w-]+)\)$/)
  if (alias) return `{${alias[1]}}`
  if (value.startsWith("#")) return value.toLowerCase()
  return value.replace(/^oklch\(([^)]+)\)$/, (_, args: string) => {
    const parts = args.split(/\s+/).map((p) => (p === "/" ? p : trimNumber(p)))
    return `oklch(${parts.join(" ")})`
  })
}

const isColor = (value: string) =>
  /^(#|oklch\(|rgba?\(|hsla?\(|var\()/.test(value)

export function colorTokens(
  css: string,
  palette: ReadonlyArray<[string, string]>
): Array<ColorToken> {
  const light = declarations(findBlock(css, ":root").body)
  const dark = declarations(findBlock(css, ".dark").body)
  const names = [...new Set([...light.keys(), ...dark.keys()])]
  const tokens: Array<ColorToken> = []
  for (const name of names) {
    const l = light.get(name)
    const d = dark.get(name)
    const first = l ?? d
    if (!first || !isColor(first.value)) continue
    const value: ThemeValue = { light: normalizeColor(first.value) }
    if (d && l && normalizeColor(d.value) !== value.light) {
      value.dark = normalizeColor(d.value)
    }
    tokens.push({ name, value, usage: l?.comment || d?.comment || "" })
  }
  for (const [name, value] of palette) {
    tokens.push({ name, value: { light: normalizeColor(value) }, usage: "" })
  }
  return tokens
}

export function themeTokens(css: string) {
  const root = declarations(findBlock(css, ":root").body)
  const theme = declarations(findBlock(css, "@theme inline").body)
  const base = root.get("radius")?.value.match(/^([\d.]+)rem$/)
  if (!base) throw new Error("globals.css :root has no --radius in rem")
  const radius = Number(base[1])

  const radii: Array<Token> = []
  const families: Record<string, string> = {}
  for (const [name, { value }] of theme) {
    if (name.startsWith("radius-")) {
      const factor =
        value === "var(--radius)"
          ? 1
          : Number(value.match(/^calc\(var\(--radius\) \* ([\d.]+)\)$/)?.[1])
      if (Number.isNaN(factor)) throw new Error(`Unreadable --${name}`)
      const rem = Math.round(radius * factor * 1000) / 1000
      radii.push({ name, value: `${rem}rem`, usage: "" })
    } else if (name.startsWith("font-")) {
      families[name.slice("font-".length)] = value
    }
  }
  return { radii, families }
}

const show = (v: ThemeValue) => (v.dark ? `${v.light} | ${v.dark}` : v.light)

export function mergeTokens(
  base: Tokens | undefined,
  source: {
    colors: Array<ColorToken>
    radii: Array<Token>
    families: Record<string, string>
    meta: Record<string, unknown>
  }
): { tokens: Tokens; changes: Array<string> } {
  const changes: Array<string> = []
  const tokens: Tokens = structuredClone(
    base ?? {
      name: "Penny Duck",
      version: 1,
      color: {
        themes: [
          { id: "light", name: "Light" },
          { id: "dark", name: "Dark" },
        ],
        tokens: [],
      },
    }
  )

  const oldColors = new Map(tokens.color.tokens.map((t) => [t.name, t]))
  tokens.color.tokens = source.colors.map((token) => {
    const old = oldColors.get(token.name)
    if (!old) changes.push(`+ color ${token.name}: ${show(token.value)}`)
    else if (show(old.value) !== show(token.value)) {
      changes.push(
        `~ color ${token.name}: ${show(old.value)} → ${show(token.value)}`
      )
    }
    return { ...token, usage: old?.usage || token.usage }
  })
  const kept = new Set(source.colors.map((t) => t.name))
  for (const name of oldColors.keys()) {
    if (!kept.has(name)) changes.push(`- color ${name}: no longer in the code`)
  }

  const radius = (tokens.radius ??= { tokens: [] })
  for (const token of source.radii) {
    const old = radius.tokens.find((t) => t.name === token.name)
    if (!old) {
      radius.tokens.push(token)
      changes.push(`+ radius ${token.name}: ${token.value}`)
    } else if (old.value !== token.value) {
      changes.push(`~ radius ${token.name}: ${old.value} → ${token.value}`)
      old.value = token.value
    }
  }

  const type = (tokens.type ??= {})
  const families = (type.families ??= {})
  for (const [name, value] of Object.entries(source.families)) {
    if (families[name] !== value) {
      changes.push(`~ font ${name}: ${families[name] ?? "(none)"} → ${value}`)
      families[name] = value
    }
  }

  tokens.meta = { ...tokens.meta, ...source.meta }
  return { tokens, changes }
}
