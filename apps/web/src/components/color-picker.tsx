import { useState } from "react"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import type { PaletteColor } from "@/lib/palette"
import { PALETTE_TOKENS, paletteColor } from "@/lib/palette"

interface ColorPickerProps {
  value: PaletteColor | null
  onChange: (token: PaletteColor) => void
  disabled?: boolean
  variant?: "swatch" | "row"
  portalContainer?: HTMLElement | null
  invalid?: boolean
  id?: string
}

export function ColorPicker({
  value,
  onChange,
  disabled,
  variant = "swatch",
  portalContainer,
  invalid,
  id,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  function handleSelect(token: PaletteColor) {
    onChange(token)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "swatch" ? (
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={value ? `Color: ${value}` : "Pick color"}
            aria-invalid={invalid}
            className={cn(
              "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border border-border bg-transparent transition-colors hover:bg-foreground/4 focus-visible:border-primary/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              invalid && "border-destructive/45"
            )}
          >
            <span
              className="size-4.5 rounded-full"
              style={{
                background: paletteColor(value, { l: 0.7, c: 0.16 }),
                outline: "1px solid rgb(0 0 0 / 0.1)",
                outlineOffset: "-1px",
              }}
            />
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
            <span
              className="size-5 shrink-0 rounded-full"
              style={{
                backgroundColor: paletteColor(value, { l: 0.7, c: 0.16 }),
              }}
            />
            <span className="flex-1 text-left capitalize">
              {value ?? (
                <span className="text-muted-foreground">Pick a color</span>
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
        className="w-60 gap-0 p-0"
      >
        <div className="flex items-baseline justify-between border-b border-border/40 px-3.5 pt-2.5 pb-1.5">
          <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Color
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/80">
            {value ?? "—"}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Color"
          className="grid grid-cols-6 gap-1.5 px-3 pt-2.5 pb-3"
        >
          {PALETTE_TOKENS.map((token) => {
            const active = value === token
            return (
              <button
                key={token}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={token}
                title={token}
                onClick={() => handleSelect(token)}
                className={cn(
                  "relative h-7 cursor-pointer rounded-[7px] border-2 border-transparent outline -outline-offset-1 outline-foreground/10 transition-transform hover:scale-[1.06]",
                  active &&
                    "border-foreground/85 outline-transparent hover:scale-100"
                )}
                style={{ background: paletteColor(token, { l: 0.7, c: 0.16 }) }}
              >
                {active && (
                  <span className="absolute inset-0 grid place-items-center text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)]">
                    <IconCheck size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
