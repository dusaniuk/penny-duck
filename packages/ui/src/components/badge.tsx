import * as React from "react"
import { cva } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "cursor-pointer border-border bg-card text-foreground/75 hover:bg-card/80 hover:text-foreground/90",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-5 px-2 py-0.5 text-xs",
        xs: "h-auto px-[9px] py-[4px] text-[11px] tracking-[0.04em]",
        sm: "h-auto px-[7px] py-[2px] text-[10.5px] tabular-nums",
        lg: "h-auto px-[11px] py-[6px] text-[12px]",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "outline",
        selected: true,
        className:
          "border-primary/45 bg-primary/10 text-primary-ink hover:bg-primary/16 hover:text-primary-ink",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      selected: false,
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  selected = false,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size, selected }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
