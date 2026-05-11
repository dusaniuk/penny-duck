import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import type { AccountData } from "@/components/accounts/account-card"
import { AccountCard, AddAccountCard } from "@/components/accounts/account-card"
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { api, queryClient } from "@/lib/api"

export const Route = createFileRoute("/_app/accounts")({
  staticData: { breadcrumb: "Accounts" },
  component: AccountsPage,
})

function AccountsPage() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts = data ?? []

  const hasBrokerage = accounts.some((a) => a.type === "brokerage")
  const { data: positionsData } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const res = await api.positions.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
    enabled: hasBrokerage,
  })
  const holdingsByAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of positionsData?.positions ?? []) {
      map.set(p.accountId, (map.get(p.accountId) ?? 0) + p.currentValue)
    }
    return map
  }, [positionsData])
  const openPositionsByAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of positionsData?.positions ?? []) {
      if (p.quantity === 0) continue
      map.set(p.accountId, (map.get(p.accountId) ?? 0) + 1)
    }
    return map
  }, [positionsData])
  const holdingsLoaded = positionsData !== undefined

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountData | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountData | null>(null)
  const [deleteTransactionCount, setDeleteTransactionCount] = useState(0)

  const createMutation = useMutation({
    mutationFn: async (body: {
      name: string
      type: string
      currency: string
      balance?: number
    }) => {
      const res = await api.accounts.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string
      body: { name?: string; type?: string }
    }) => {
      const res = await api.accounts[":id"].$patch({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].default.$put({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
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

  function handleSetDefault(account: AccountData) {
    setDefaultMutation.mutate(account.id)
  }

  async function handleOpenDelete(account: AccountData) {
    setDeleteAccount(account)
    try {
      const res = await api.transactions.$get({
        query: { accountId: account.id, limit: "1" },
      })
      const body = res.ok ? await res.json() : null
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
        id: editAccount.id,
        body: { name: formData.name, type: formData.type },
      })
    } else {
      await createMutation.mutateAsync({
        name: formData.name,
        type: formData.type,
        currency: formData.currency!,
        balance: formData.balance,
      })
    }
  }

  async function handleDelete() {
    if (!deleteAccount) return
    await deleteMutation.mutateAsync(deleteAccount.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Accounts</h1>
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
              onSetDefault={handleSetDefault}
              onClick={() => {}}
              holdings={
                account.type === "brokerage" && holdingsLoaded
                  ? (holdingsByAccount.get(account.id) ?? 0)
                  : undefined
              }
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
        openPositionCount={
          deleteAccount ? (openPositionsByAccount.get(deleteAccount.id) ?? 0) : 0
        }
        onConfirm={handleDelete}
      />
    </div>
  )
}
