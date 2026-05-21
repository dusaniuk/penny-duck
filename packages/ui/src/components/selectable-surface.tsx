import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const selectableSurfaceVariants = cva(
  "cursor-pointer rounded-[11px] border border-border bg-card transition-colors hover:bg-card/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
  {
    variants: {
      selected: {
        true: "border-orange-500 dark:bg-orange-500/6",
        false: "",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
)

function SelectableSurface({
  className,
  selected = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof selectableSurfaceVariants>) {
  return (
    <button
      type={type}
      data-slot="selectable-surface"
      className={cn(selectableSurfaceVariants({ selected, className }))}
      {...props}
    />
  )
}

export { SelectableSurface, selectableSurfaceVariants }
