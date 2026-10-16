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
import type { ArchiveTarget } from "@/components/accounts/account-archive-dialog"
import { AccountArchiveDialog } from "@/components/accounts/account-archive-dialog"
import { AccountEmptyState } from "@/components/accounts/account-empty-state"
import { AccountFormDialog } from "@/components/accounts/account-form-dialog"
import { AccountsGroups } from "@/components/accounts/accounts-groups"
import { AccountsNetWorthCard } from "@/components/accounts/accounts-net-worth-card"
import { PageHeader } from "@/components/page-header"
import { api, queryClient } from "@/lib/api"
import { isArchived, leafAccountsOf, walletsOf } from "@/lib/accounts"

type AccountType = "bank" | "wallet" | "brokerage" | "loan"

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
  const archivedWallets = useMemo(
    () => walletsOf(data, { includeArchived: true }).filter(isArchived),
    [data]
  )
  const archivedAccounts = useMemo(
    () => leafAccountsOf(data, { includeArchived: true }).filter(isArchived),
    [data]
  )

  // Transaction counts per account: disables deleting a pocket that has
  // transactions in the wallet-edit dialog, and decides whether the archive
  // dialog may also offer a hard delete.
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
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null)
  const archiveTransactionCount = useMemo(() => {
    if (!archiveTarget) return 0
    const wallet = wallets.find((w) => w.id === archiveTarget.id)
    if (wallet) {
      return wallet.pockets.reduce(
        (sum, p) => sum + (pocketTransactionCounts[p.accountId] ?? 0),
        0
      )
    }
    return pocketTransactionCounts[archiveTarget.id] ?? 0
  }, [archiveTarget, wallets, pocketTransactionCounts])

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

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].archive.$put({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => invalidateAccounts(),
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.accounts[":id"].archive.$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => invalidateAccounts(),
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

  function handleOpenArchive(account: AccountData) {
    setArchiveTarget({ id: account.id, name: account.name, type: account.type })
  }

  function handleOpenArchiveWallet(wallet: Wallet) {
    setArchiveTarget({ id: wallet.id, name: wallet.name, type: "wallet" })
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
          cardLabel: input.cardLabel,
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
        cardLabel: input.cardLabel ?? undefined,
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

  async function handleArchive() {
    if (!archiveTarget) return
    try {
      await archiveMutation.mutateAsync(archiveTarget.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't archive"))
      throw err
    }
  }

  async function handleDelete() {
    if (!archiveTarget) return
    try {
      await deleteMutation.mutateAsync(archiveTarget.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete"))
      throw err
    }
  }

  async function handleUnarchive(account: AccountData) {
    try {
      await unarchiveMutation.mutateAsync(account.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't unarchive"))
    }
  }

  // Archived entries keep the grid (and the Unarchive path) on screen; only a
  // truly empty org gets the onboarding state. Totals stay active-only.
  const activeCount = standaloneAccounts.length + wallets.length
  const archivedCount = archivedAccounts.length + archivedWallets.length
  const hasContent = !loading && activeCount > 0
  const isEmpty = !loading && activeCount + archivedCount === 0

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Accounts"
        title="Where your money lives"
        action={
          <Button
            type="button"
            variant={isEmpty ? "outline" : "default"}
            onClick={handleOpenCreate}
          >
            <IconPlus />
            New account
          </Button>
        }
      />

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
          archivedAccounts={archivedAccounts}
          archivedWallets={archivedWallets}
          homeCurrency={user.homeCurrency}
          seriesByAccount={seriesByAccount}
          onEdit={handleEdit}
          onSetDefault={handleSetDefault}
          onEditWallet={handleEditWallet}
          onUnarchive={handleUnarchive}
        />
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editAccount}
        wallet={editWallet}
        initialType={pendingType ?? undefined}
        existingAccountColors={standaloneAccounts.map((a) => a.color)}
        existingAccountIcons={standaloneAccounts.map((a) => a.icon)}
        onSubmit={handleSubmit}
        onSubmitWallet={handleSubmitWallet}
        onArchive={handleOpenArchive}
        onArchiveWallet={handleOpenArchiveWallet}
        onAddPocket={handleAddPocket}
        onDeletePocket={handleDeletePocket}
        pocketTransactionCounts={pocketTransactionCounts}
      />

      <AccountArchiveDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        target={archiveTarget}
        transactionCount={archiveTransactionCount}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </div>
  )
}
