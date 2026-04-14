import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"

interface MonthNavigatorProps {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

function formatMonth(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date()
  return year === now.getFullYear() && month === now.getMonth()
}

export function MonthNavigator({
  year,
  month,
  onChange,
}: MonthNavigatorProps) {
  function goBack() {
    if (month === 0) {
      onChange(year - 1, 11)
    } else {
      onChange(year, month - 1)
    }
  }

  function goForward() {
    if (isCurrentMonth(year, month)) return
    if (month === 11) {
      onChange(year + 1, 0)
    } else {
      onChange(year, month + 1)
    }
  }

  const atCurrentMonth = isCurrentMonth(year, month)

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={goBack}
      >
        <IconChevronLeft className="size-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium">
        {formatMonth(year, month)}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={goForward}
        disabled={atCurrentMonth}
      >
        <IconChevronRight className="size-4" />
      </Button>
    </div>
  )
}
