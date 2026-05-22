import { useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import type { InferRequestType } from "hono/client"
import type { AccountData } from "@/components/accounts/account-card"
import type { AccountSubmitData } from "@/components/accounts/account-form-dialog"
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog"
import { AccountEmptyState } from "@/components/accounts/account-empty-state"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { AccountsGroups } from "@/components/accounts/accounts-groups"
import { AccountsNetWorthCard } from "@/components/accounts/accounts-net-worth-card"
import { api, queryClient } from "@/lib/api"

type AccountType = "bank" | "cash" | "brokerage"

type CreateAccountBody = InferRequestType<typeof api.accounts.$post>["json"]
type UpdateAccountBody = InferRequestType<
  (typeof api.accounts)[":id"]["$patch"]
>["json"]

export const Route = createFileRoute("/_app/accounts")({
  staticData: { breadcrumb: "Accounts" },
  component: AccountsPage,
})

const appRouteApi = getRouteApi("/_app")

function AccountsPage() {
  const { user } = appRouteApi.useRouteContext()
  const { data, isLoading: loading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts = data ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountData | null>(null)
  const [pendingType, setPendingType] = useState<AccountType | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountData | null>(null)
  const [deleteTransactionCount, setDeleteTransactionCount] = useState(0)

  const createMutation = useMutation({
    mutationFn: async (body: CreateAccountBody) => {
      const res = await api.accounts.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; body: UpdateAccountBody }) => {
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
    setPendingType(null)
    setFormOpen(true)
  }

  function handleQuickPick(type: AccountType) {
    setEditAccount(null)
    setPendingType(type)
    setFormOpen(true)
  }

  function handleEdit(account: AccountData) {
    setPendingType(null)
    setEditAccount(account)
    setFormOpen(true)
  }

  async function handleSetDefault(account: AccountData) {
    await setDefaultMutation.mutateAsync(account.id)
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

  async function handleSubmit(input: AccountSubmitData) {
    if (input.id) {
      await updateMutation.mutateAsync({
        id: input.id,
        body: {
          name: input.name,
          type: input.type,
          color: input.color,
          icon: input.icon,
          isDefault: input.isDefault,
        },
      })
    } else {
      await createMutation.mutateAsync({
        name: input.name,
        type: input.type,
        currency: input.currency,
        color: input.color,
        icon: input.icon,
        balance: input.balance,
        isDefault: input.isDefault,
      })
    }
  }

  async function handleDelete() {
    if (!deleteAccount) return
    await deleteMutation.mutateAsync(deleteAccount.id)
  }

  const isEmpty = !loading && accounts.length === 0

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-primary uppercase">
            <span className="size-1.5 rounded-full bg-primary" />
            Accounts
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Where your money lives
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenCreate}
        >
          <IconPlus />
          New account
        </Button>
      </div>

      {!loading && !isEmpty && <AccountsNetWorthCard accounts={accounts} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <AccountEmptyState
          onAdd={handleOpenCreate}
          onAddWithType={handleQuickPick}
        />
      ) : (
        <AccountsGroups
          accounts={accounts}
          homeCurrency={user.homeCurrency}
          onEdit={handleEdit}
          onSetDefault={handleSetDefault}
        />
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditAccount(null)
            setPendingType(null)
          }
        }}
        account={editAccount}
        initialType={pendingType ?? undefined}
        existingAccountColors={accounts.map((a) => a.color)}
        existingAccountIcons={accounts.map((a) => a.icon)}
        onSubmit={handleSubmit}
        onArchive={handleOpenDelete}
      />

      <AccountDeleteDialog
        open={!!deleteAccount}
        onOpenChange={(open) => {
          if (!open) setDeleteAccount(null)
        }}
        account={deleteAccount}
        transactionCount={deleteTransactionCount}
        openPositionCount={0}
        onConfirm={handleDelete}
      />
    </div>
  )
}
