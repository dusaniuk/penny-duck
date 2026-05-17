import type { Category } from "@workspace/api-contract"

export type CategoryColor =
  | "red"
  | "coral"
  | "orange"
  | "peach"
  | "amber"
  | "yellow"
  | "lime"
  | "chartreuse"
  | "green"
  | "mint"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "azure"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "lavender"
  | "fuchsia"
  | "plum"
  | "magenta"
  | "pink"
  | "rose"
  | "slate"
  | "gray"
  | "zinc"
  | "neutral"
  | "stone"

export const PALETTE_TOKENS: ReadonlyArray<CategoryColor> = [
  "red",
  "coral",
  "orange",
  "peach",
  "amber",
  "yellow",
  "lime",
  "chartreuse",
  "green",
  "mint",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "azure",
  "blue",
  "indigo",
  "violet",
  "purple",
  "lavender",
  "fuchsia",
  "plum",
  "magenta",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
]

type Oklch = { l: number; c: number; h: number }

const PALETTE: Record<CategoryColor, Oklch> = {
  red: { l: 0.65, c: 0.2, h: 25 },
  coral: { l: 0.7, c: 0.18, h: 15 },
  orange: { l: 0.7, c: 0.17, h: 50 },
  peach: { l: 0.78, c: 0.13, h: 60 },
  amber: { l: 0.78, c: 0.16, h: 80 },
  yellow: { l: 0.85, c: 0.17, h: 95 },
  lime: { l: 0.82, c: 0.18, h: 115 },
  chartreuse: { l: 0.78, c: 0.18, h: 130 },
  green: { l: 0.7, c: 0.18, h: 145 },
  mint: { l: 0.72, c: 0.13, h: 160 },
  emerald: { l: 0.65, c: 0.16, h: 175 },
  teal: { l: 0.65, c: 0.13, h: 195 },
  cyan: { l: 0.7, c: 0.13, h: 210 },
  sky: { l: 0.65, c: 0.15, h: 225 },
  azure: { l: 0.62, c: 0.16, h: 240 },
  blue: { l: 0.58, c: 0.18, h: 255 },
  indigo: { l: 0.55, c: 0.2, h: 275 },
  violet: { l: 0.55, c: 0.22, h: 290 },
  purple: { l: 0.55, c: 0.22, h: 305 },
  lavender: { l: 0.7, c: 0.13, h: 295 },
  fuchsia: { l: 0.62, c: 0.22, h: 325 },
  plum: { l: 0.55, c: 0.16, h: 335 },
  magenta: { l: 0.62, c: 0.2, h: 345 },
  pink: { l: 0.72, c: 0.16, h: 355 },
  rose: { l: 0.65, c: 0.2, h: 10 },
  slate: { l: 0.55, c: 0.05, h: 250 },
  gray: { l: 0.55, c: 0.02, h: 270 },
  zinc: { l: 0.55, c: 0.01, h: 290 },
  neutral: { l: 0.55, c: 0.0, h: 0 },
  stone: { l: 0.55, c: 0.04, h: 60 },
}

const NEUTRAL: Oklch = { l: 0.55, c: 0.02, h: 250 }
const SHADE_OFFSETS = [+0.15, -0.15, +0.3, -0.3]

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function oklchCss({ l, c, h }: Oklch, a?: number): string {
  return a != null
    ? `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${a})`
    : `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}

function isKnownToken(s: string | null | undefined): s is CategoryColor {
  return (
    s !== null &&
    s !== undefined &&
    (PALETTE_TOKENS as ReadonlyArray<string>).includes(s)
  )
}

export const NEUTRAL_COLOR = oklchCss(NEUTRAL)

export interface PaletteColorOpts {
  l?: number
  c?: number
  a?: number
}

export function paletteColor(
  token: string | null | undefined,
  opts?: PaletteColorOpts
): string {
  const base = isKnownToken(token) ? PALETTE[token] : NEUTRAL
  if (!opts) return isKnownToken(token) ? oklchCss(base) : NEUTRAL_COLOR
  return oklchCss(
    { l: opts.l ?? base.l, c: opts.c ?? base.c, h: base.h },
    opts.a
  )
}

export function categoryColor(
  category: Category,
  all: ReadonlyArray<Category>
): string {
  if (category.parentId === null) {
    return paletteColor(category.color)
  }
  const parent = all.find((c) => c.id === category.parentId)
  if (!parent || !isKnownToken(parent.color)) return NEUTRAL_COLOR

  const siblings = all
    .filter((c) => c.parentId === parent.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const index = siblings.findIndex((c) => c.id === category.id)
  if (index < 0) return NEUTRAL_COLOR

  const offset = SHADE_OFFSETS[index % SHADE_OFFSETS.length]
  const base = PALETTE[parent.color]
  return oklchCss({
    l: clamp(base.l + offset, 0.25, 0.92),
    c: base.c,
    h: base.h,
  })
}

export function pickRandomUnusedColor(
  existing: ReadonlyArray<string | null>
): CategoryColor {
  const used = new Set(existing.filter((c): c is string => c !== null))
  const free = PALETTE_TOKENS.filter((t) => !used.has(t))
  const pool = free.length > 0 ? free : PALETTE_TOKENS
  return pool[Math.floor(Math.random() * pool.length)]
}
