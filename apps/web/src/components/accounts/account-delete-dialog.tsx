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
import type { AccountData } from "@/components/accounts/account-card"

interface AccountDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountData | null
  onConfirm: () => Promise<void>
}

export function AccountDeleteDialog({
  open,
  onOpenChange,
  account,
  onConfirm,
}: AccountDeleteDialogProps) {
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
            Delete &ldquo;{account?.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the account and all its associated
            transactions. This action cannot be undone.
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
