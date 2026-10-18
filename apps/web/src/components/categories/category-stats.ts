import type { Category, CategoryUsageItem } from "@workspace/api-contract"

// Per-category usage keyed by id. Built from the `/categories/usage` response.
export type StatsMap = Map<string, CategoryUsageItem>

export interface ParentRollup {
  subCount: number
  spentThisMonth: number
  countThisMonth: number
  lastActivityAt: string | null
}

// Coerce anything non-numeric (undefined/null/NaN) to 0 so a missing field —
// e.g. a stale API response without the month-scoped stats — degrades to 0
// instead of poisoning every downstream calculation with NaN.
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function buildStatsMap(
  usage: ReadonlyArray<CategoryUsageItem> | undefined
): StatsMap {
  const map: StatsMap = new Map()
  for (const u of usage ?? []) map.set(u.categoryId, u)
  return map
}

export function statFor(stats: StatsMap, id: string): CategoryUsageItem {
  const s = stats.get(id)
  return {
    categoryId: id,
    count: num(s?.count),
    countThisMonth: num(s?.countThisMonth),
    spentThisMonth: num(s?.spentThisMonth),
    lastActivityAt: s?.lastActivityAt ?? null,
  }
}

// A parent's figures are its own directly-assigned transactions plus all of its
// children's. Last activity is the most recent across the whole subtree. ISO
// UTC strings sort chronologically, so a string compare gives the max date.
export function rollupParent(
  parentId: string,
  children: ReadonlyArray<Category>,
  stats: StatsMap
): ParentRollup {
  let spentThisMonth = 0
  let countThisMonth = 0
  let lastActivityAt: string | null = null

  for (const id of [parentId, ...children.map((c) => c.id)]) {
    const s = statFor(stats, id)
    spentThisMonth += s.spentThisMonth
    countThisMonth += s.countThisMonth
    if (
      s.lastActivityAt &&
      (!lastActivityAt || s.lastActivityAt > lastActivityAt)
    ) {
      lastActivityAt = s.lastActivityAt
    }
  }

  return {
    subCount: children.length,
    spentThisMonth,
    countThisMonth,
    lastActivityAt,
  }
}

export function sharePct(part: number, whole: number): number {
  if (!Number.isFinite(part) || whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 30) return `${diff} days ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
