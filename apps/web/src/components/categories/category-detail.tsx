import { useState } from "react"
import {
  IconArchive,
  IconArchiveOff,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { CategoryIconChip } from "./category-icon-chip"
import { CategorySubcategoryCard } from "./category-subcategory-card"
import {
  formatMoney,
  formatRelativeDate,
  rollupParent,
  sharePct,
  statFor,
} from "./category-stats"
import type { Category } from "@workspace/api-contract"
import type { StatsMap } from "./category-stats"
import { isArchivedCategory } from "@/lib/categories"
import { categoryShadeVars, paletteColor } from "@/lib/palette"

interface CategoryDetailProps {
  parent: Category
  children: ReadonlyArray<Category>
  stats: StatsMap
  totalSpent: number
  homeCurrency: string
  onEdit: (category: Category) => void
  onArchive: (category: Category) => void
  onUnarchive: (category: Category) => void
  onDelete: (category: Category) => void
  onAddChild: (parent: Category) => void
}

export function CategoryDetail({
  parent,
  children,
  stats,
  totalSpent,
  homeCurrency,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onAddChild,
}: CategoryDetailProps) {
  const roll = rollupParent(parent.id, children, stats)
  const average =
    roll.countThisMonth > 0 ? roll.spentThisMonth / roll.countThisMonth : 0
  const parentArchived = isArchivedCategory(parent)
  // An archived parent took every child with it, so they all render in the
  // main grid. Under a live parent, archived children fold into their own
  // collapsed group so the working set stays uncluttered.
  const liveChildren = parentArchived
    ? children
    : children.filter((c) => !isArchivedCategory(c))
  const archivedChildren = parentArchived
    ? []
    : children.filter(isArchivedCategory)
  const [showArchived, setShowArchived] = useState(false)

  const cardProps = {
    parentColor: parent.color,
    parentSpent: roll.spentThisMonth,
    homeCurrency,
    onEdit,
    onArchive,
    onUnarchive,
    onDelete,
  }

  return (
    <section className="space-y-5">
      <div
        style={categoryShadeVars(parent.color)}
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[140px] -right-[80px] size-[280px] rounded-full bg-(--halo-l) dark:bg-(--halo-d)"
          style={{ filter: "blur(60px)" }}
        />

        <div className="relative flex items-start gap-4">
          <CategoryIconChip color={parent.color} icon={parent.icon} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold text-(--chip-fg-l) dark:text-(--chip-fg-d)">
              <span className="truncate">{parent.name}</span>
              {parentArchived && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Archived
                </Badge>
              )}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-muted-foreground">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: paletteColor(parent.color) }}
              />
              <span className="capitalize">{parent.color ?? "neutral"}</span>
              <span aria-hidden>·</span>
              <span>
                {roll.subCount}{" "}
                {roll.subCount === 1 ? "subcategory" : "subcategories"}
              </span>
              <span aria-hidden>·</span>
              <span>{roll.countThisMonth} tx this month</span>
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {parentArchived ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUnarchive(parent)}
                >
                  <IconArchiveOff size={15} />
                  Unarchive
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${parent.name}`}
                  onClick={() => onDelete(parent)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <IconTrash size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${parent.name}`}
                  onClick={() => onEdit(parent)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconPencil size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Archive ${parent.name}`}
                  onClick={() => onArchive(parent)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconArchive size={16} />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
          <Stat
            label="Spend this month"
            value={formatMoney(roll.spentThisMonth)}
            unit={homeCurrency}
            sub={`${sharePct(roll.spentThisMonth, totalSpent)}% of total`}
          />
          <Stat
            label="Last activity"
            value={formatRelativeDate(roll.lastActivityAt)}
            sub={`${roll.countThisMonth} transactions`}
          />
          <Stat
            label="Average"
            value={formatMoney(average)}
            unit={homeCurrency}
            sub="per transaction"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Subcategories</h3>
        {!parentArchived && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddChild(parent)}
          >
            <IconPlus size={16} />
            Add subcategory
          </Button>
        )}
      </div>

      {liveChildren.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {archivedChildren.length > 0
              ? `Every subcategory of ${parent.name} is archived.`
              : `No subcategories yet — break ${parent.name} down to see where the money goes.`}
          </p>
          {!parentArchived && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddChild(parent)}
            >
              <IconPlus size={16} />
              Add subcategory
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {liveChildren.map((child) => (
            <CategorySubcategoryCard
              key={child.id}
              category={child}
              stat={statFor(stats, child.id)}
              {...cardProps}
            />
          ))}
        </div>
      )}

      {archivedChildren.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Archived{" "}
              <span className="font-mono text-[11px]">
                {archivedChildren.length}
              </span>
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide" : "Show"}
              <IconChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  showArchived && "rotate-180"
                )}
              />
            </Button>
          </div>
          {showArchived && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {archivedChildren.map((child) => (
                <CategorySubcategoryCard
                  key={child.id}
                  category={child}
                  stat={statFor(stats, child.id)}
                  {...cardProps}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

interface StatProps {
  label: string
  value: string
  unit?: string
  sub: string
}

function Stat({ label, value, unit, sub }: StatProps) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="font-heading text-xl font-semibold text-foreground tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  )
}
