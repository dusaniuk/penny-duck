import { IconLoader2, IconPlus, IconTag } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { DEFAULT_CATEGORY_SET } from "@workspace/shared/categories"
import type { CSSProperties } from "react"
import type { DefaultCategoryGroup } from "@workspace/shared/categories"
import { paletteColor } from "@/lib/palette"
import { getIcon } from "@/lib/icons"

interface CategoryEmptyStateProps {
  onUseDefaults: () => void
  onCreateFirst: () => void
  isSeeding: boolean
}

const TOTAL_COUNT = DEFAULT_CATEGORY_SET.reduce(
  (sum, group) => sum + 1 + group.children.length,
  0
)

export function CategoryEmptyState({
  onUseDefaults,
  onCreateFirst,
  isSeeding,
}: CategoryEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="max-w-[20ch] font-heading text-2xl font-bold tracking-tight text-foreground md:text-[32px] md:leading-[1.1]">
          Three buckets, ranked by how much you can flex
        </h2>
        <p className="max-w-[52ch] text-[13.5px] leading-[1.6] text-muted-foreground">
          Start with our default categories — grouped from must-pay bills to
          comfortable lifestyle spend to the guilty-pleasure end. See where your
          money sits, and squeeze the right tier when you want to save.
        </p>
      </div>

      <Card className="mt-8 w-full overflow-hidden rounded-2xl p-1.5">
        <div className="flex items-center justify-between px-3.5 py-3">
          <span className="font-mono text-[10.5px] tracking-widest text-muted-foreground/70 uppercase">
            Default set
          </span>
          <span className="font-mono text-[10.5px] tracking-widest text-muted-foreground/60 uppercase">
            {TOTAL_COUNT} categories · 3 spend tiers + income
          </span>
        </div>
        <div className="space-y-1.5">
          {DEFAULT_CATEGORY_SET.map((group) => (
            <TierBlock key={group.name} group={group} />
          ))}
        </div>
      </Card>

      <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onCreateFirst}
          disabled={isSeeding}
          className="w-full sm:w-auto"
        >
          <IconPlus className="size-4" />
          Create your first
        </Button>
        <Button
          type="button"
          onClick={onUseDefaults}
          disabled={isSeeding}
          className="w-full sm:w-auto"
        >
          {isSeeding ? <IconLoader2 className="size-4 animate-spin" /> : null}
          Use default set
        </Button>
      </div>
    </div>
  )
}

function tierVars(color: string): CSSProperties {
  return {
    "--tier-fg-l": paletteColor(color, { l: 0.5, c: 0.18 }),
    "--tier-fg-d": paletteColor(color, { l: 0.78, c: 0.14 }),
    "--tier-bg-l": paletteColor(color, { l: 0.93, c: 0.1 }),
    "--tier-bg-d": paletteColor(color, { l: 0.42, c: 0.1, a: 0.18 }),
    "--tier-halo-l": paletteColor(color, { l: 0.72, c: 0.15, a: 0.45 }),
    "--tier-halo-d": paletteColor(color, { l: 0.55, c: 0.16, a: 0.3 }),
  } as CSSProperties
}

function TierBlock({ group }: { group: DefaultCategoryGroup }) {
  return (
    <section
      className="rounded-xl bg-foreground/1.5 p-2.5"
      style={tierVars(group.color)}
    >
      <div className="relative flex items-center gap-3 overflow-hidden rounded-[11px] border border-border bg-card px-3 py-2.5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[110px] -right-[70px] size-[200px] rounded-full bg-(--tier-halo-l) dark:bg-(--tier-halo-d)"
          style={{ filter: "blur(44px)" }}
        />
        <span className="relative grid size-9 shrink-0 place-items-center rounded-[10px] border border-foreground/5 bg-(--tier-bg-l) text-(--tier-fg-l) dark:bg-(--tier-bg-d) dark:text-(--tier-fg-d)">
          <TierIcon name={group.icon} size={18} />
        </span>
        <div className="relative flex min-w-0 flex-1 items-center gap-2.5">
          <RankBadge rank={group.rank} />
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold text-foreground">
              {group.name}
            </p>
            <p className="text-[11.5px] text-muted-foreground italic">
              {group.subtitle}
            </p>
          </div>
        </div>
        <span className="relative shrink-0 rounded-full bg-foreground/6 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {group.children.length} subs
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-1 pt-2.5">
        {group.children.map((sub) => (
          <SubPill key={sub.name} sub={sub} />
        ))}
      </div>
    </section>
  )
}

function SubPill({ sub }: { sub: { name: string; icon: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-2.5 pl-1">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-(--tier-bg-l) text-(--tier-fg-l) dark:bg-(--tier-bg-d) dark:text-(--tier-fg-d)">
        <TierIcon name={sub.icon} size={12} />
      </span>
      <span className="text-[12.5px] font-medium text-foreground">
        {sub.name}
      </span>
    </span>
  )
}

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        rank === null
          ? "bg-foreground/6 text-muted-foreground"
          : "bg-foreground/10 text-foreground"
      )}
    >
      {rank ?? "$"}
    </span>
  )
}

function TierIcon({ name, size }: { name: string; size: number }) {
  const Icon = getIcon(name)?.component ?? IconTag
  return <Icon size={size} />
}
