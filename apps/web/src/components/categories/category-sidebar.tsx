import { useState } from "react"
import { IconChevronDown, IconPlus } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { CategoryIconChip } from "./category-icon-chip"
import { formatMoney, rollupParent, sharePct } from "./category-stats"
import type { Category } from "@workspace/api-contract"
import type { StatsMap } from "./category-stats"
import { categoryShadeVars } from "@/lib/palette"

interface CategorySidebarProps {
  parents: ReadonlyArray<Category>
  archivedParents: ReadonlyArray<Category>
  childrenByParent: Map<string, Array<Category>>
  stats: StatsMap
  totalSpent: number
  selectedId: string | null
  onSelect: (id: string) => void
  onCreateParent: () => void
}

export function CategorySidebar({
  parents,
  archivedParents,
  childrenByParent,
  stats,
  totalSpent,
  selectedId,
  onSelect,
  onCreateParent,
}: CategorySidebarProps) {
  const [showArchived, setShowArchived] = useState(false)

  function renderRow(parent: Category, archived: boolean) {
    const children = childrenByParent.get(parent.id) ?? []
    const roll = rollupParent(parent.id, children, stats)
    const pct = sharePct(roll.spentThisMonth, totalSpent)
    const selected = parent.id === selectedId

    return (
      <li key={parent.id}>
        <button
          type="button"
          onClick={() => onSelect(parent.id)}
          aria-current={selected}
          style={selected ? categoryShadeVars(parent.color) : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
            selected
              ? "bg-(--chip-bg-soft-l) dark:bg-(--chip-bg-d)"
              : "hover:bg-foreground/4",
            archived && "opacity-70 saturate-50 hover:opacity-100"
          )}
        >
          <CategoryIconChip color={parent.color} icon={parent.icon} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-medium text-foreground">
                {parent.name}
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-foreground tabular-nums">
                {formatMoney(roll.spentThisMonth)}
              </span>
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
              <span>
                {roll.subCount} {roll.subCount === 1 ? "sub" : "subs"}
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  selected && "text-(--chip-fg-l) dark:text-(--chip-fg-d)"
                )}
              >
                {pct}%
              </span>
            </span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <aside className="rounded-2xl border border-border bg-card p-2">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">
          All categories
        </h2>
        <span className="grid min-w-5 place-items-center rounded-full bg-foreground/6 px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {parents.length}
        </span>
      </div>

      {parents.length > 0 && (
        <ul className="space-y-0.5">
          {parents.map((parent) => renderRow(parent, false))}
        </ul>
      )}

      {archivedParents.length > 0 && (
        <div className="mt-2 border-t border-border/60 pt-2">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-foreground/4 hover:text-foreground"
          >
            <span>
              Archived{" "}
              <span className="font-mono text-[11px]">
                {archivedParents.length}
              </span>
            </span>
            <IconChevronDown
              className={cn(
                "size-3.5 transition-transform",
                showArchived && "rotate-180"
              )}
            />
          </button>
          {showArchived && (
            <ul className="mt-1 space-y-0.5">
              {archivedParents.map((parent) => renderRow(parent, true))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onCreateParent}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <IconPlus size={16} />
        New parent
      </button>
    </aside>
  )
}
