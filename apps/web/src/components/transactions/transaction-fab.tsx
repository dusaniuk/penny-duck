import { IconPlus } from "@tabler/icons-react"

interface TransactionFabProps {
  onOpen: () => void
}

export function TransactionFab({ onOpen }: TransactionFabProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:bg-primary/90"
    >
      <IconPlus className="size-5" />
    </button>
  )
}
