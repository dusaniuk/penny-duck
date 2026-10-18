import { useMemo, useState } from "react"
import {
  IconArrowLeft,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconX,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { useIsDark } from "@workspace/ui/hooks/use-is-dark"
import { cn } from "@workspace/ui/lib/utils"
import type { Category } from "@workspace/api-contract"
import { pickerGroups } from "@/lib/categories"
import { paletteColor } from "@/lib/palette"
import { getIcon } from "@/lib/icons"

// Lightness/chroma for category accents shifts per theme: pale colors read
// on a dark surface, vivid darker colors read on a light surface.
const FG_OPTS_DARK = { l: 0.78, c: 0.14 } as const
const FG_OPTS_LIGHT = { l: 0.5, c: 0.18 } as const
const BG_OPTS_DARK = { l: 0.42, c: 0.1, a: 0.4 } as const
const BG_OPTS_LIGHT = { l: 0.62, c: 0.16, a: 0.18 } as const

interface TransactionCategoryPickerProps {
  categories: Array<Category>
  selectedId: string | null
  recentIds: ReadonlyArray<string>
  onSelect: (id: string) => void
  onClose: () => void
  onCreateCategory?: () => void
  variant?: "desktop" | "mobile"
}

const ICON_BTN_CLASS =
  "size-7.5 bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground"

const CHIP_CLASS =
  "flex min-w-0 cursor-pointer items-center gap-1.75 rounded-[8px] border border-foreground/5 bg-foreground/2 px-2.25 py-1.75 text-left text-[11.5px] font-medium text-foreground/78 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

export function TransactionCategoryPicker({
  categories,
  selectedId,
  recentIds,
  onSelect,
  onClose,
  onCreateCategory,
  variant = "desktop",
}: TransactionCategoryPickerProps) {
  const [search, setSearch] = useState("")
  const isDark = useIsDark()
  const fgOpts = isDark ? FG_OPTS_DARK : FG_OPTS_LIGHT
  const bgOpts = isDark ? BG_OPTS_DARK : BG_OPTS_LIGHT

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )
  const q = search.trim().toLowerCase()
  const groups = useMemo(
    () => pickerGroups(categories, search),
    [categories, search]
  )

  const gridCols = variant === "mobile" ? "grid-cols-2" : "grid-cols-3"
  const bodyMaxH = variant === "mobile" ? "max-h-[600px]" : "max-h-[540px]"

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Back to form"
          className={ICON_BTN_CLASS}
        >
          <IconArrowLeft size={16} />
        </Button>
        <div className="flex-1 text-center font-heading text-[14px] font-semibold text-foreground">
          Select category
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
          className={ICON_BTN_CLASS}
        >
          <IconX size={16} />
        </Button>
      </div>

      <InputGroup className="h-auto rounded-[11px] border-foreground/6 bg-foreground/4 px-3 py-2.5 [&_input]:text-base [&_input]:text-foreground [&_input]:placeholder:text-foreground/35 md:[&_input]:text-[13px]">
        <InputGroupAddon align="inline-start" className="text-foreground/40">
          <IconSearch size={15} />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          placeholder="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              className="grid size-4.5 place-items-center rounded-full border-0 bg-foreground/10 text-foreground/70"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IconX size={12} />
            </button>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div
        className={cn(
          "-mx-1 flex scrollbar-none flex-col gap-3.5 overflow-y-auto px-1 pb-1 [&::-webkit-scrollbar]:w-0",
          bodyMaxH
        )}
      >
        {q === "" && recentIds.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-foreground/45 uppercase">
                <IconSparkles size={12} /> Recent
              </span>
            </div>
            <div className={cn("grid gap-1", gridCols)}>
              {recentIds.map((id) => {
                const c = byId.get(id)
                // Parents are not selectable in this picker, so don't surface
                // them via the Recent shortcut either.
                if (!c || c.parentId === null) return null
                const fg = paletteColor(c.color, fgOpts)
                const bg = paletteColor(c.color, bgOpts)
                const active = c.id === selectedId
                const icon = getIcon(c.icon)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={CHIP_CLASS}
                    aria-pressed={active}
                    style={
                      active
                        ? { background: bg, borderColor: fg, color: fg }
                        : undefined
                    }
                  >
                    <span
                      className="grid shrink-0 place-items-center"
                      style={{ color: fg }}
                    >
                      {icon ? <icon.component size={15} /> : null}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {groups.map(({ parent, children }) => {
          const fg = paletteColor(parent.color, fgOpts)
          const parentIcon = getIcon(parent.icon)
          return (
            <div key={parent.id} className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <div
                  className="flex w-full items-center gap-2 rounded-[9px] border border-foreground/5 bg-foreground/2.5 px-2.75 py-2 text-[13px] font-medium text-foreground"
                  role="presentation"
                >
                  <span
                    className="grid shrink-0 place-items-center"
                    style={{ color: fg }}
                  >
                    {parentIcon ? <parentIcon.component size={15} /> : null}
                  </span>
                  <span className="flex-1">{parent.name}</span>
                  <Badge
                    size="sm"
                    variant="secondary"
                    className="border-0 bg-foreground/5 text-foreground/40"
                  >
                    {children.length}
                  </Badge>
                </div>
              </div>
              <div
                className={cn(
                  "relative grid gap-1 pl-5.5 before:absolute before:inset-y-1 before:left-2.5 before:w-px before:bg-foreground/[0.07] before:content-['']",
                  gridCols
                )}
              >
                {children.map((child) => {
                  const active = child.id === selectedId
                  const childIcon = getIcon(child.icon)
                  const childFg = paletteColor(child.color, fgOpts)
                  const childBg = paletteColor(child.color, bgOpts)
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelect(child.id)}
                      aria-pressed={active}
                      className={cn(CHIP_CLASS, "text-[11px]")}
                      style={
                        active
                          ? {
                              background: childBg,
                              borderColor: childFg,
                              color: childFg,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="grid size-4.5 shrink-0 place-items-center"
                        style={{ color: childFg }}
                      >
                        {childIcon ? <childIcon.component size={13} /> : null}
                      </span>
                      <span className="truncate">{child.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {onCreateCategory && (
          <Button
            type="button"
            variant="outline"
            onClick={onCreateCategory}
            className="mt-1 h-auto w-full justify-center gap-1.75 rounded-[10px] border border-dashed border-foreground/12 bg-transparent p-2.75 text-[12.5px] font-medium text-foreground/50 hover:border-primary/40 hover:bg-transparent hover:text-primary-ink"
          >
            <IconPlus size={14} />
            Create new category
          </Button>
        )}
      </div>
    </>
  )
}
