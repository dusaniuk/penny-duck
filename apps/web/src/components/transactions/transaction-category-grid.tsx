import { IconDots } from "@tabler/icons-react"
import { useIsDark } from "@workspace/ui/hooks/use-is-dark"
import { cn } from "@workspace/ui/lib/utils"
import type { Category, CategoryUsageItem } from "@workspace/api-contract"
import { paletteColor } from "@/lib/category-color"
import { getCategoryIcon } from "@/lib/category-icons"

// Lightness/chroma for category accents shifts per theme: pale colors read
// on a dark surface, vivid darker colors read on a light surface.
const FG_OPTS_DARK = { l: 0.78, c: 0.14 } as const
const FG_OPTS_LIGHT = { l: 0.5, c: 0.18 } as const
const BG_OPTS_DARK = { l: 0.42, c: 0.1, a: 0.4 } as const
const BG_OPTS_LIGHT = { l: 0.62, c: 0.16, a: 0.18 } as const

interface TransactionCategoryGridProps {
  categories: Array<Category>
  usage?: ReadonlyArray<CategoryUsageItem>
  selectedId: string | null
  onSelect: (id: string) => void
  onMore: () => void
  onClearSelection: () => void
  variant?: "desktop" | "mobile"
}

const VISIBLE_CHILDREN = 7

const CELL_CLASS =
  "flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border border-foreground/[0.05] bg-foreground/[0.025] px-1 pt-2.5 pb-2 text-center text-foreground/[0.78] transition-colors hover:bg-foreground/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"

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
  onClearSelection,
  variant = "desktop",
}: TransactionCategoryGridProps) {
  const isDark = useIsDark()
  const fgOpts = isDark ? FG_OPTS_DARK : FG_OPTS_LIGHT
  const bgOpts = isDark ? BG_OPTS_DARK : BG_OPTS_LIGHT

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
  const selectedParent =
    selectedCat?.parentId !== null && selectedCat?.parentId !== undefined
      ? (byId.get(selectedCat.parentId) ?? null)
      : null

  // Surface the selected child even if its usage rank is below the visible
  // cut-off, so the active state always lights up in the grid.
  const visible = (() => {
    const head = sortedChildren.slice(0, VISIBLE_CHILDREN)
    if (selectedCat && !head.some((c) => c.id === selectedCat.id)) {
      return [selectedCat, ...head.slice(0, VISIBLE_CHILDREN - 1)]
    }
    return head
  })()

  const gridCols = variant === "mobile" ? "grid-cols-3" : "grid-cols-4"
  const gridGap = variant === "mobile" ? "gap-[7px]" : "gap-1.5"

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <span className="mb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-foreground/40">
          Category
        </span>
        {selectedCat && selectedParent && (
          <span className="mb-2 text-[11px] font-medium text-foreground/50">
            {selectedParent.name} ›
          </span>
        )}
      </div>
      <div className={cn("grid", gridCols, gridGap)}>
        {visible.map((c) => {
          const active = c.id === selectedId
          const token = parentTokenFor(c, byId)
          const fg = paletteColor(token, fgOpts)
          const bg = paletteColor(token, bgOpts)
          const icon = getCategoryIcon(c.icon)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={CELL_CLASS}
              aria-pressed={active}
              style={
                active
                  ? { background: bg, color: fg, borderColor: fg }
                  : undefined
              }
            >
              <span
                className="grid size-[22px] shrink-0 place-items-center"
                style={{ color: fg }}
              >
                {icon ? <icon.component size={16} /> : null}
              </span>
              <span className="max-w-full truncate text-[11px] font-medium leading-[1.15]">
                {c.name}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onMore}
          className={cn(CELL_CLASS, "border-dashed text-foreground/50")}
          aria-label="More categories"
        >
          <span className="grid size-[22px] shrink-0 place-items-center">
            <IconDots size={16} />
          </span>
          <span className="max-w-full truncate text-[11px] font-medium leading-[1.15]">
            More…
          </span>
        </button>
      </div>
      {selectedCat && selectedCat.parentId !== null && (
        <div className="mt-2 flex items-center gap-[7px] rounded-[9px] border border-foreground/[0.06] bg-foreground/[0.025] px-[11px] py-[7px] text-[12px] font-medium text-foreground">
          {(() => {
            const icon = getCategoryIcon(selectedCat.icon)
            const token = parentTokenFor(selectedCat, byId)
            return (
              <span style={{ color: paletteColor(token, fgOpts) }}>
                {icon ? <icon.component size={13} /> : null}
              </span>
            )
          })()}
          <span>{selectedCat.name}</span>
          <button
            type="button"
            className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[11px] text-foreground/40 hover:text-orange-400"
            onClick={onClearSelection}
          >
            change
          </button>
        </div>
      )}
    </div>
  )
}
