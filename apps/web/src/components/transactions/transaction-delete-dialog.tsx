import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

interface TransactionDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isTransfer: boolean
  onConfirm: () => Promise<void>
}

export function TransactionDeleteDialog({
  open,
  onOpenChange,
  isTransfer,
  onConfirm,
}: TransactionDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete this {isTransfer ? "transfer" : "transaction"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTransfer
              ? "This will delete both sides of the transfer and restore the account balances."
              : "This will permanently delete this transaction and adjust the account balance."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
