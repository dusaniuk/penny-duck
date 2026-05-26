import { IconTag } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { getIcon } from "@/lib/icons"
import { categoryShadeVars } from "@/lib/palette"

// Mirrors AccountIconChip (accounts/account-card.tsx): a light tinted surface
// with a colour-matched icon that reads in both themes. Subcategories pass the
// parent's colour so children inherit the parent's shade.
const SIZES = {
  sm: { box: "size-9 rounded-[10px]", icon: 17 },
  md: { box: "size-10 rounded-xl", icon: 18 },
  lg: { box: "size-14 rounded-2xl", icon: 26 },
} as const

interface CategoryIconChipProps {
  color: string | null
  icon: string | null
  size?: keyof typeof SIZES
  className?: string
}

export function CategoryIconChip({
  color,
  icon,
  size = "md",
  className,
}: CategoryIconChipProps) {
  const def = getIcon(icon)
  const Icon = def?.component ?? IconTag
  const s = SIZES[size]

  return (
    <span
      style={categoryShadeVars(color)}
      className={cn(
        "grid shrink-0 place-items-center border border-foreground/5 bg-(--chip-bg-l) text-(--chip-fg-l) dark:bg-(--chip-bg-d) dark:text-(--chip-fg-d)",
        s.box,
        className
      )}
    >
      <Icon size={s.icon} />
    </span>
  )
}
