import { useMemo, useState } from "react"
import { IconChevronDown, IconSearch } from "@tabler/icons-react"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import type { IconDef } from "@/lib/icons"
import { ICONS, getIcon, searchIcons } from "@/lib/icons"

interface IconPickerProps {
  value: string | null
  onChange: (name: string) => void
  disabled?: boolean
  variant?: "swatch" | "row"
  portalContainer?: HTMLElement | null
  invalid?: boolean
  id?: string
}

export function IconPicker({
  value,
  onChange,
  disabled,
  variant = "swatch",
  portalContainer,
  invalid,
  id,
}: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selected = getIcon(value)

  const filtered = useMemo(() => searchIcons(search), [search])

  const grouped = useMemo(() => {
    if (search) return null
    const acc = new Map<string, Array<IconDef>>()
    for (const icon of ICONS) {
      const arr = acc.get(icon.group)
      if (arr) arr.push(icon)
      else acc.set(icon.group, [icon])
    }
    return Array.from(acc.entries())
  }, [search])

  function handleSelect(icon: IconDef) {
    onChange(icon.name)
    setOpen(false)
    setSearch("")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === "swatch" ? (
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={selected ? `Icon: ${selected.label}` : "Pick icon"}
            aria-invalid={invalid}
            className={cn(
              "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border border-border bg-transparent text-foreground transition-colors hover:bg-foreground/4 focus-visible:border-primary/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              invalid && "border-destructive/45"
            )}
          >
            {selected ? (
              <selected.component className="size-4" />
            ) : (
              <span className="text-muted-foreground">?</span>
            )}
          </button>
        ) : (
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-invalid={invalid}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              invalid && "border-destructive/45"
            )}
          >
            <span className="grid size-5 shrink-0 place-items-center text-foreground">
              {selected ? (
                <selected.component className="size-4" />
              ) : (
                <span className="text-muted-foreground">?</span>
              )}
            </span>
            <span className="flex-1 text-left">
              {selected?.label ?? (
                <span className="text-muted-foreground">Pick an icon</span>
              )}
            </span>
            <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        container={portalContainer}
        className="w-72 gap-0 p-0"
      >
        <div className="flex items-baseline justify-between border-b border-border/40 px-3.5 pt-2.5 pb-1.5">
          <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Icon
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/80">
            {selected?.name ?? "—"}
          </span>
        </div>
        <div className="border-b border-border/40 px-2.5 py-2">
          <div className="relative">
            <IconSearch className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="h-8 border-0 bg-foreground/4 pl-7 text-[13px] focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-80 scrollbar-none overflow-y-auto px-2.5 pt-2 pb-2.5 [&::-webkit-scrollbar]:w-0">
          {grouped ? (
            grouped.map(([group, icons]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="mb-1 px-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/80 uppercase">
                  {group}
                </p>
                <IconGrid
                  icons={icons}
                  selectedName={value}
                  onSelect={handleSelect}
                />
              </div>
            ))
          ) : filtered.length > 0 ? (
            <IconGrid
              icons={filtered}
              selectedName={value}
              onSelect={handleSelect}
            />
          ) : (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">
              No icons found
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface IconGridProps {
  icons: ReadonlyArray<IconDef>
  selectedName: string | null
  onSelect: (icon: IconDef) => void
}

function IconGrid({ icons, selectedName, onSelect }: IconGridProps) {
  return (
    <div role="radiogroup" className="grid grid-cols-6 gap-1.5">
      {icons.map((icon) => {
        const active = selectedName === icon.name
        const Component = icon.component
        return (
          <button
            key={icon.name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={icon.label}
            title={icon.label}
            onClick={() => onSelect(icon)}
            className={cn(
              "grid size-9 cursor-pointer place-items-center rounded-[10px] border border-transparent text-foreground/85 transition-colors hover:bg-foreground/5",
              active &&
                "border-primary/45 bg-primary/10 text-primary hover:bg-primary/10"
            )}
          >
            <Component className="size-4.5" />
          </button>
        )
      })}
    </div>
  )
}
