import { useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type { CategoryColor } from "@/lib/category-color"
import { PALETTE_TOKENS, paletteColor } from "@/lib/category-color"

interface ColorPickerProps {
  value: CategoryColor | null
  onChange: (token: CategoryColor) => void
  disabled?: boolean
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  function handleSelect(token: CategoryColor) {
    onChange(token)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50"
        >
          <span
            className="size-5 shrink-0 rounded-full"
            style={{ backgroundColor: paletteColor(value) }}
          />
          <span className="flex-1 text-left capitalize">
            {value ?? (
              <span className="text-muted-foreground">Pick a color</span>
            )}
          </span>
          <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-3"
        align="start"
      >
        <div
          role="radiogroup"
          aria-label="Color"
          className="grid grid-cols-5 gap-2"
        >
          {PALETTE_TOKENS.map((token) => {
            const selected = value === token
            return (
              <button
                key={token}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={token}
                title={token}
                onClick={() => handleSelect(token)}
                className={
                  "size-9 rounded-full transition-transform " +
                  (selected
                    ? "scale-110 outline-2 outline-offset-2 outline-foreground"
                    : "hover:scale-110")
                }
                style={{ backgroundColor: paletteColor(token) }}
              />
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
