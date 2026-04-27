import { useState } from "react"
import { IconSearch } from "@tabler/icons-react"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type { CategoryIcon } from "@/lib/category-icons"
import { CATEGORY_ICONS, getCategoryIcon } from "@/lib/category-icons"

interface IconPickerProps {
  value: string | null
  onChange: (iconName: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  const selected = getCategoryIcon(value)

  const filtered = search
    ? CATEGORY_ICONS.filter(
        (i) =>
          i.label.toLowerCase().includes(search.toLowerCase()) ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.group.toLowerCase().includes(search.toLowerCase())
      )
    : CATEGORY_ICONS

  const groups = filtered.reduce<Record<string, Array<CategoryIcon>>>(
    (acc, icon) => {
      acc[icon.group] = [...(acc[icon.group] ?? []), icon]
      return acc
    },
    {}
  )

  function handleSelect(icon: CategoryIcon) {
    onChange(icon.name)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={setContainer}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input bg-transparent text-sm transition-colors hover:bg-accent"
          >
            {selected ? (
              <selected.component className="size-4" />
            ) : (
              <span className="text-muted-foreground">?</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-0"
          align="start"
          container={container}
        >
          <div className="border-b p-2">
            <div className="relative">
              <IconSearch className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="h-9 pl-7 text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {Object.entries(groups).map(([group, icons]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  {group}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {icons.map((icon) => (
                    <button
                      key={icon.name}
                      type="button"
                      onClick={() => handleSelect(icon)}
                      title={icon.label}
                      className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent ${
                        value === icon.name
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground"
                      }`}
                    >
                      <icon.component className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No icons found
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
