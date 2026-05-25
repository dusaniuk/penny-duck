import type { ReactNode } from "react"

type PageHeaderProps = {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-primary uppercase">
          <span className="size-1.5 rounded-full bg-primary" />
          {eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
