import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { AccountData } from "@/components/accounts/account-card"
import { AccountCard, AddAccountCard } from "@/components/accounts/account-card"
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsPage,
})

function AccountsPage() {
  const [accounts, setAccounts] = useState<Array<AccountData>>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountData | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountData | null>(null)
  const [deleteTransactionCount, setDeleteTransactionCount] = useState(0)

  async function refetch() {
    const res = await api.get("/accounts")
    const data = await res.json()
    setAccounts(data)
  }

  useEffect(() => {
    api
      .get("/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }, [])

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
      const res = await api.get(
        `/transactions?accountId=${account.id}&limit=1`
      )
      const data = await res.json()
      setDeleteTransactionCount(data.total ?? 0)
    } catch {
      setDeleteTransactionCount(0)
    }
  }

  async function handleFormSubmit(data: {
    name: string
    type: string
    currency?: string
    balance?: number
  }) {
    let res: Response
    if (editAccount) {
      res = await api.patch(`/accounts/${editAccount.id}`, data)
    } else {
      res = await api.post("/accounts", data)
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }

    await refetch()
  }

  async function handleDelete(
    mode: "move" | "orphan" | "delete",
    targetAccountId?: string
  ) {
    if (!deleteAccount) return
    const res = await api.del(`/accounts/${deleteAccount.id}`, {
      mode,
      ...(targetAccountId ? { targetAccountId } : {}),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    await refetch()
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
        accounts={accounts}
        transactionCount={deleteTransactionCount}
        onConfirm={handleDelete}
      />
    </div>
  )
}
