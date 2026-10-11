import { useState } from "react"
import { IconCalendar } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { parseLocalDate, toLocalIso } from "@/lib/dates"

interface DatePickerProps {
  /** YYYY-MM-DD, or "" for no selection */
  value: string
  onChange: (iso: string) => void
  /** Clicking the selected day again clears the value */
  clearable?: boolean
  /** YYYY-MM-DD — days after this are disabled */
  max?: string
  id?: string
  placeholder?: string
  className?: string
}

function formatLabel(iso: string): string | undefined {
  const d = parseLocalDate(iso)
  if (!d) return undefined
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function DatePicker({
  value,
  onChange,
  clearable = false,
  max,
  id,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const label = formatLabel(value)
  const maxDate = max ? parseLocalDate(max) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-8 w-full justify-start gap-2 border-input bg-transparent px-2.5 font-normal hover:bg-transparent dark:bg-input/30 dark:hover:bg-input/30",
            !label && "text-muted-foreground",
            className
          )}
        >
          <IconCalendar className="size-4 shrink-0 text-muted-foreground" />
          {label ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={parseLocalDate(value)}
          disabled={maxDate ? { after: maxDate } : undefined}
          onSelect={(d) => {
            if (!d) {
              if (clearable) onChange("")
              return
            }
            onChange(toLocalIso(d))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
