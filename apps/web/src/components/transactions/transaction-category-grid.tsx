import { IconDots } from "@tabler/icons-react"
import { useIsDark } from "@workspace/ui/hooks/use-is-dark"
import { SelectableSurface } from "@workspace/ui/components/selectable-surface"
import { cn } from "@workspace/ui/lib/utils"
import type { Category, CategoryUsageItem } from "@workspace/api-contract"
import { paletteColor } from "@/lib/palette"
import { getIcon } from "@/lib/icons"

// Lightness/chroma for category accents shifts per theme: pale colors read
// on a dark surface, vivid darker colors read on a light surface.
const FG_OPTS_DARK = { l: 0.78, c: 0.14 } as const
const FG_OPTS_LIGHT = { l: 0.5, c: 0.18 } as const

interface TransactionCategoryGridProps {
  categories: Array<Category>
  usage?: ReadonlyArray<CategoryUsageItem>
  selectedId: string | null
  onSelect: (id: string) => void
  onMore: () => void
  variant?: "desktop" | "mobile"
}

// Grid is 4 cols on desktop / 3 cols on mobile. Keep visible-cell count one
// less than a full grid so "More…" fills the last slot — and bump mobile to
// 8 so the layout fills three rows of three instead of leaving a half-row.
const VISIBLE_CHILDREN_DESKTOP = 7
const VISIBLE_CHILDREN_MOBILE = 8

const CELL_LAYOUT =
  "flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-center text-foreground/[0.78]"

// Children inherit their visual color from their parent (top-level categories
// hold the palette token; children carry null).
function parentTokenFor(
  child: Category,
  byId: Map<string, Category>
): string | null {
  if (child.parentId === null) return child.color
  const parent = byId.get(child.parentId)
  return parent?.color ?? null
}

export function TransactionCategoryGrid({
  categories,
  usage = [],
  selectedId,
  onSelect,
  onMore,
  variant = "desktop",
}: TransactionCategoryGridProps) {
  const isDark = useIsDark()
  const fgOpts = isDark ? FG_OPTS_DARK : FG_OPTS_LIGHT

  const byId = new Map(categories.map((c) => [c.id, c]))
  const children = categories.filter((c) => c.parentId !== null)
  const usageById = new Map(usage.map((u) => [u.categoryId, u.count]))

  // Most-used first, then alphabetical as a stable tiebreaker.
  const sortedChildren = [...children].sort((a, b) => {
    const countDiff = (usageById.get(b.id) ?? 0) - (usageById.get(a.id) ?? 0)
    if (countDiff !== 0) return countDiff
    return a.name.localeCompare(b.name)
  })

  const selectedCat = selectedId ? (byId.get(selectedId) ?? null) : null

  const visibleCount =
    variant === "mobile" ? VISIBLE_CHILDREN_MOBILE : VISIBLE_CHILDREN_DESKTOP
  // Only need a "More…" affordance when there are more children than fit.
  // For e.g. the income tab (usually 3–4 categories) the grid stays flush.
  const showMore = sortedChildren.length > visibleCount

  // Surface the selected child even if its usage rank is below the visible
  // cut-off, so the active state always lights up in the grid.
  const visible = (() => {
    const head = sortedChildren.slice(0, visibleCount)
    if (selectedCat && !head.some((c) => c.id === selectedCat.id)) {
      return [selectedCat, ...head.slice(0, visibleCount - 1)]
    }
    return head
  })()

  const gridCols = variant === "mobile" ? "grid-cols-3" : "grid-cols-4"
  const gridGap = variant === "mobile" ? "gap-[7px]" : "gap-1.5"

  return (
    <div className="flex flex-col">
      <span className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-foreground/40 uppercase">
        Category
      </span>
      <div className={cn("grid", gridCols, gridGap)}>
        {visible.map((c) => {
          const active = c.id === selectedId
          const token = parentTokenFor(c, byId)
          const fg = paletteColor(token, fgOpts)
          const icon = getIcon(c.icon)
          return (
            <SelectableSurface
              key={c.id}
              aria-pressed={active}
              onClick={() => onSelect(c.id)}
              className={CELL_LAYOUT}
              style={active ? { color: fg, borderColor: fg } : undefined}
            >
              <span
                className="grid size-[22px] shrink-0 place-items-center"
                style={{ color: fg }}
              >
                {icon ? <icon.component size={16} /> : null}
              </span>
              <span className="max-w-full truncate text-[11px] leading-[1.15] font-medium">
                {c.name}
              </span>
            </SelectableSurface>
          )
        })}
        {showMore && (
          <SelectableSurface
            onClick={onMore}
            aria-label="More categories"
            className={cn(CELL_LAYOUT, "border-dashed text-foreground/50")}
          >
            <span className="grid size-[22px] shrink-0 place-items-center">
              <IconDots size={16} />
            </span>
            <span className="max-w-full truncate text-[11px] leading-[1.15] font-medium">
              More…
            </span>
          </SelectableSurface>
        )}
      </div>
    </div>
  )
}
