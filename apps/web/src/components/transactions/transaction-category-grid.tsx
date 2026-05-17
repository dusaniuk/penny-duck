import { IconDots } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { Category, CategoryUsageItem } from "@workspace/api-contract"
import { paletteColor } from "@/lib/category-color"
import { getCategoryIcon } from "@/lib/category-icons"

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
  "flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border border-white/[0.05] bg-white/[0.025] px-1 pt-2.5 pb-2 text-center text-white/[0.78] transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"

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
        <span className="mb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-white/40">
          Category
        </span>
        {selectedCat && selectedParent && (
          <span className="mb-2 text-[11px] font-medium text-white/50">
            {selectedParent.name} ›
          </span>
        )}
      </div>
      <div className={cn("grid", gridCols, gridGap)}>
        {visible.map((c) => {
          const active = c.id === selectedId
          const token = parentTokenFor(c, byId)
          const fg = paletteColor(token, { l: 0.78, c: 0.14 })
          const bg = paletteColor(token, { l: 0.42, c: 0.1, a: 0.4 })
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
          className={cn(CELL_CLASS, "border-dashed text-white/50")}
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
        <div className="mt-2 flex items-center gap-[7px] rounded-[9px] border border-white/[0.06] bg-white/[0.025] px-[11px] py-[7px] text-[12px] font-medium text-foreground">
          {(() => {
            const icon = getCategoryIcon(selectedCat.icon)
            const token = parentTokenFor(selectedCat, byId)
            return (
              <span
                style={{ color: paletteColor(token, { l: 0.78, c: 0.14 }) }}
              >
                {icon ? <icon.component size={13} /> : null}
              </span>
            )
          })()}
          <span>{selectedCat.name}</span>
          <button
            type="button"
            className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[11px] text-white/40 hover:text-orange-400"
            onClick={onClearSelection}
          >
            change
          </button>
        </div>
      )}
    </div>
  )
}
