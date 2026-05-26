import { IconPencil, IconTrash } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { CategoryIconChip } from "./category-icon-chip"
import { formatMoney, formatRelativeDate, sharePct } from "./category-stats"
import type { Category, CategoryUsageItem } from "@workspace/api-contract"
import { categoryShadeVars } from "@/lib/palette"

interface CategorySubcategoryCardProps {
  category: Category
  // Children inherit their parent's colour; the card's shade derives from it.
  parentColor: string | null
  stat: CategoryUsageItem
  parentSpent: number
  homeCurrency: string
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

export function CategorySubcategoryCard({
  category,
  parentColor,
  stat,
  parentSpent,
  homeCurrency,
  onEdit,
  onDelete,
}: CategorySubcategoryCardProps) {
  const pct = sharePct(stat.spentThisMonth, parentSpent)
  const used = stat.countThisMonth > 0

  const actions = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${category.name}`}
        onClick={() => onEdit(category)}
        className="text-muted-foreground hover:text-foreground"
      >
        <IconPencil size={15} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${category.name}`}
        onClick={() => onDelete(category)}
        className="text-muted-foreground hover:text-destructive"
      >
        <IconTrash size={15} />
      </Button>
    </div>
  )

  return (
    <div
      style={categoryShadeVars(parentColor)}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[90px] -right-[60px] size-[170px] rounded-full bg-(--halo-l) dark:bg-(--halo-d)"
        style={{ filter: "blur(40px)" }}
      />

      {/* Mobile: compact single row — icon, then name + money to its right */}
      <div className="relative flex items-center gap-3 sm:hidden">
        <CategoryIconChip color={parentColor} icon={category.icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-(--chip-fg-l) dark:text-(--chip-fg-d)">
            {category.name}
          </p>
          {used ? (
            <p className="flex items-baseline gap-1">
              <span className="text-[15px] font-semibold text-(--chip-fg-l) tabular-nums dark:text-(--chip-fg-d)">
                {formatMoney(stat.spentThisMonth)}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {homeCurrency}
              </span>
              <span className="text-[11px] text-muted-foreground">· {pct}%</span>
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">unused</p>
          )}
        </div>
        {actions}
      </div>

      {/* Desktop: full card with progress + activity footer */}
      <div className="relative hidden sm:block">
        <div className="flex items-start justify-between gap-2">
          <CategoryIconChip color={parentColor} icon={category.icon} size="md" />
          {actions}
        </div>

        <p className="mt-3 truncate text-[13.5px] font-medium text-(--chip-fg-l) dark:text-(--chip-fg-d)">
          {category.name}
        </p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-semibold text-(--chip-fg-l) tabular-nums dark:text-(--chip-fg-d)">
            {formatMoney(stat.spentThisMonth)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {homeCurrency}
          </span>
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className="h-full rounded-full bg-(--chip-fg-l) dark:bg-(--chip-fg-d)"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
          {used ? (
            <span>
              {stat.countThisMonth} tx ·{" "}
              {formatRelativeDate(stat.lastActivityAt)}
            </span>
          ) : (
            <span>unused</span>
          )}
          <span className="font-medium text-(--chip-fg-l) tabular-nums dark:text-(--chip-fg-d)">
            {pct}%
          </span>
        </div>
      </div>
    </div>
  )
}
