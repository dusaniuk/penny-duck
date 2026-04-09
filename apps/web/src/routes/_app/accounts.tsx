import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { AccountData } from "@/components/accounts/account-card"
import { AccountCard, AddAccountCard } from "@/components/accounts/account-card"
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { queryClient, tsr } from "@/lib/api"

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsPage,
})

function AccountsPage() {
  const { data, isLoading: loading } =
    tsr.accounts.list.useQuery({ queryKey: ["accounts"] })
  const accounts = data?.body ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountData | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountData | null>(null)
  const [deleteTransactionCount, setDeleteTransactionCount] = useState(0)

  const createMutation = tsr.accounts.create.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const updateMutation = tsr.accounts.update.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const deleteMutation = tsr.accounts.delete.useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  function handleOpenCreate() {
    setEditAccount(null)
    setFormOpen(true)
  }

  function handleEdit(account: AccountData) {
    setEditAccount(account)
    setFormOpen(true)
  }

  async function handleOpenDelete(account: AccountData) {
    setDeleteAccount(account)
    try {
      const result = await tsr.transactions.list.query({
        query: { accountId: account.id, limit: 1 },
      })
      const body = result.status === 200 ? result.body : null
      setDeleteTransactionCount(body?.total ?? 0)
    } catch {
      setDeleteTransactionCount(0)
    }
  }

  async function handleFormSubmit(formData: {
    name: string
    type: string
    currency?: string
    balance?: number
  }) {
    if (editAccount) {
      await updateMutation.mutateAsync({
        params: { id: editAccount.id },
        body: { name: formData.name, type: formData.type },
      })
    } else {
      await createMutation.mutateAsync({
        body: {
          name: formData.name,
          type: formData.type,
          currency: formData.currency!,
          balance: formData.balance,
        },
      })
    }
  }

  async function handleDelete() {
    if (!deleteAccount) return
    await deleteMutation.mutateAsync({
      params: { id: deleteAccount.id },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Accounts</h1>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={handleEdit}
              onDelete={handleOpenDelete}
              onClick={() => {}}
            />
          ))}
          <AddAccountCard onClick={handleOpenCreate} />
        </div>
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditAccount(null)
        }}
        account={editAccount}
        onSubmit={handleFormSubmit}
      />

      <AccountDeleteDialog
        open={!!deleteAccount}
        onOpenChange={(open) => {
          if (!open) setDeleteAccount(null)
        }}
        account={deleteAccount}
        transactionCount={deleteTransactionCount}
        onConfirm={handleDelete}
      />
    </div>
  )
}
