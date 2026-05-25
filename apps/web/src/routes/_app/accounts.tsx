import { useMemo, useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import type { InferRequestType } from "hono/client"
import type { Wallet } from "@workspace/api-contract"
import type { AccountData } from "@/components/accounts/account-card"
import type {
  AccountSubmitData,
  WalletSubmitData,
} from "@/components/accounts/account-form-dialog"
import { AccountDeleteDialog } from "@/components/accounts/account-delete-dialog"
import { AccountEmptyState } from "@/components/accounts/account-empty-state"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { AccountsGroups } from "@/components/accounts/accounts-groups"
import { AccountsNetWorthCard } from "@/components/accounts/accounts-net-worth-card"
import { api, queryClient } from "@/lib/api"
import { leafAccountsOf, walletsOf } from "@/lib/accounts"

type AccountType = "bank" | "wallet" | "brokerage"

function errorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

type CreateAccountBody = InferRequestType<typeof api.accounts.$post>["json"]
type UpdateAccountBody = InferRequestType<
  (typeof api.accounts)[":id"]["$patch"]
>["json"]

export const Route = createFileRoute("/_app/accounts")({
  staticData: { breadcrumb: "Accounts" },
  component: AccountsPage,
})

const appRouteApi = getRouteApi("/_app")

function invalidateAccounts() {
  return queryClient.invalidateQueries({ queryKey: ["accounts"] })
}

function AccountsPage() {
  const { user } = appRouteApi.useRouteContext()

  // ── Accounts query (flat list of leaf accounts + wallets) ─────────────────
  const { data, isLoading: loading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const wallets = useMemo(() => walletsOf(data), [data])
  const standaloneAccounts = useMemo(() => leafAccountsOf(data), [data])

  // Transaction counts per account, used to disable deleting a pocket that has
  // transactions in the wallet-edit dialog.
  const { data: usageData } = useQuery({
    queryKey: ["accounts", "usage"],
    queryFn: async () => {
      const res = await api.accounts.usage.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const pocketTransactionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of usageData ?? []) counts[u.accountId] = u.count
    return counts
  }, [usageData])

  // ── Series query ──────────────────────────────────────────────────────────
  const { data: seriesData } = useQuery({
    queryKey: ["accounts", "series", 30],
    queryFn: async () => {
      const res = await api.accounts.series.$get({ query: { days: "30" } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const seriesByAccount = useMemo(() => {
    const map = new Map<string, Array<number>>()
    for (const item of seriesData?.accounts ?? []) {
      map.set(
        item.accountId,
        item.points.map((p) => p.balance)
      )
    }
    for (const item of seriesData?.wallets ?? []) {
      map.set(
        item.walletId,
        item.points.map((p) => p.balance)
      )
    }
    return map
  }, [seriesData])

  // ── UI state ──────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountData | null>(null)
  const [editWallet, setEditWallet] = useState<Wallet | null>(null)
  const [pendingType, setPendingType] = useState<AccountType | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<AccountData | null>(null)
  const [deleteTransactionCount, setDeleteTransactionCount] = useState(0)

  // ── Account mutations ─────────────────────────────────────────────────────
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

  // ── Pocket mutations (wallet create/update/delete reuse the account ones) ──
  const addPocketMutation = useMutation({
    mutationFn: async (vars: {
      walletId: string
      currency: string
      balance: number
    }) => {
      const res = await api.accounts[":id"].pockets.$post({
        param: { id: vars.walletId },
        json: { currency: vars.currency, balance: vars.balance },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => invalidateAccounts(),
  })

  const deletePocketMutation = useMutation({
    mutationFn: async (vars: { walletId: string; currency: string }) => {
      const res = await api.accounts[":id"].pockets[":currency"].$delete({
        param: { id: vars.walletId, currency: vars.currency },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => invalidateAccounts(),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleOpenCreate() {
    setEditAccount(null)
    setEditWallet(null)
    setPendingType(null)
    setFormOpen(true)
  }

  function handleQuickPick(type: AccountType) {
    setEditAccount(null)
    setEditWallet(null)
    setPendingType(type)
    setFormOpen(true)
  }

  function handleEdit(account: AccountData) {
    setPendingType(null)
    setEditAccount(account)
    setEditWallet(null)
    setFormOpen(true)
  }

  function handleEditWallet(wallet: Wallet) {
    setPendingType(null)
    setEditAccount(null)
    setEditWallet(wallet)
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
      // handleSubmit only runs for leaf accounts; wallets go via onSubmitWallet.
      await createMutation.mutateAsync({
        type: input.type as "bank" | "brokerage",
        name: input.name,
        currency: input.currency,
        color: input.color,
        icon: input.icon,
        balance: input.balance,
        isDefault: input.isDefault,
      })
    }
  }

  async function handleSubmitWallet(input: WalletSubmitData) {
    if (input.id) {
      await updateMutation.mutateAsync({
        id: input.id,
        body: { name: input.name, color: input.color, icon: input.icon },
      })
    } else {
      await createMutation.mutateAsync({
        type: "wallet",
        name: input.name,
        color: input.color,
        icon: input.icon,
        pockets: input.pockets,
      })
    }
  }

  // The mutation returns the refreshed wallet, so we set it straight onto the
  // open dialog rather than re-reading the (possibly not-yet-refetched) cache.
  // Add errors propagate to the dialog, which renders them inline.
  async function handleAddPocket(
    walletId: string,
    currency: string,
    balance: number
  ) {
    const updated = await addPocketMutation.mutateAsync({
      walletId,
      currency,
      balance,
    })
    setEditWallet(updated)
  }

  async function handleDeletePocket(walletId: string, currency: string) {
    try {
      const updated = await deletePocketMutation.mutateAsync({
        walletId,
        currency,
      })
      setEditWallet(updated)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the pocket"))
    }
  }

  async function handleDeleteWallet(wallet: Wallet) {
    await deleteMutation.mutateAsync(wallet.id)
  }

  async function handleDelete() {
    if (!deleteAccount) return
    await deleteMutation.mutateAsync(deleteAccount.id)
  }

  const totalCount = standaloneAccounts.length + wallets.length
  const hasContent = !loading && totalCount > 0
  const isEmpty = !loading && totalCount === 0

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
          variant={isEmpty ? "outline" : "default"}
          onClick={handleOpenCreate}
        >
          <IconPlus />
          New account
        </Button>
      </div>

      {hasContent && (
        <AccountsNetWorthCard accounts={standaloneAccounts} wallets={wallets} />
      )}

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
          accounts={standaloneAccounts}
          wallets={wallets}
          homeCurrency={user.homeCurrency}
          seriesByAccount={seriesByAccount}
          onEdit={handleEdit}
          onSetDefault={handleSetDefault}
          onEditWallet={handleEditWallet}
        />
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditAccount(null)
            setEditWallet(null)
            setPendingType(null)
          }
        }}
        account={editAccount}
        wallet={editWallet}
        initialType={pendingType ?? undefined}
        existingAccountColors={standaloneAccounts.map((a) => a.color)}
        existingAccountIcons={standaloneAccounts.map((a) => a.icon)}
        onSubmit={handleSubmit}
        onSubmitWallet={handleSubmitWallet}
        onArchive={handleOpenDelete}
        onDeleteWallet={handleDeleteWallet}
        onAddPocket={handleAddPocket}
        onDeletePocket={handleDeletePocket}
        pocketTransactionCounts={pocketTransactionCounts}
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
