import { useEffect, useRef, useState } from "react"
import {
  IconArrowsExchange,
  IconMinus,
  IconPlus,
  IconX,
} from "@tabler/icons-react"

interface TransactionFabProps {
  onExpense: () => void
  onIncome: () => void
  onTransfer: () => void
}

const menuItems = [
  {
    key: "expense",
    label: "Expense",
    icon: IconMinus,
    color: "bg-red-500 hover:bg-red-600",
  },
  {
    key: "income",
    label: "Income",
    icon: IconPlus,
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    key: "transfer",
    label: "Transfer",
    icon: IconArrowsExchange,
    color: "bg-violet-500 hover:bg-violet-600",
  },
] as const

export function TransactionFab({
  onExpense,
  onIncome,
  onTransfer,
}: TransactionFabProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  function handleAction(key: string) {
    setOpen(false)
    if (key === "expense") onExpense()
    else if (key === "income") onIncome()
    else if (key === "transfer") onTransfer()
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      <div
        className={`mb-3 flex flex-col items-end gap-2 transition-all ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        {menuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleAction(item.key)}
            className="flex items-center gap-2"
          >
            <span className="rounded-md bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md">
              {item.label}
            </span>
            <span
              className={`flex size-9 items-center justify-center rounded-full text-white shadow-md ${item.color}`}
            >
              <item.icon className="size-4" />
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:bg-primary/90"
      >
        {open ? (
          <IconX className="size-5" />
        ) : (
          <IconPlus className="size-5" />
        )}
      </button>
    </div>
  )
}
