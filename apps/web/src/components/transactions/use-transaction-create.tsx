import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import type {
  AccountUsageItem,
  Category,
  CategoryUsageItem,
  Member,
} from "@workspace/api-contract"
import { api, queryClient, unwrap } from "@/lib/api"
import { flattenAccounts, walletsOf } from "@/lib/accounts"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"

interface UseTransactionCreateOptions {
  onSuccess?: () => void
}

export function useTransactionCreate(options?: UseTransactionCreateOptions) {
  const [open, setOpen] = useState(false)

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => unwrap(api.accounts.$get()),
  })
  const accountsForForm = useMemo(
    () => flattenAccounts(accountsData),
    [accountsData]
  )
  const wallets = walletsOf(accountsData)
  const defaultAccountId = accountsForForm.find((a) => a.isDefault)?.id

  const { data: accountUsageData } = useQuery({
    queryKey: ["accounts", "usage"],
    queryFn: () => unwrap(api.accounts.usage.$get()),
  })
  const accountUsage: Array<AccountUsageItem> = accountUsageData ?? []

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => unwrap(api.categories.$get()),
  })
  const categories: Array<Category> = categoriesData ?? []

  const { data: categoryUsageData } = useQuery({
    queryKey: ["categories", "usage"],
    queryFn: () => unwrap(api.categories.usage.$get()),
  })
  const categoryUsage: Array<CategoryUsageItem> = categoryUsageData ?? []

  const { data: meData } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => unwrap(api.users.me.$get()),
  })
  const currentUserId = meData?.id ?? ""

  const { data: membersData } = useQuery({
    queryKey: ["users", "members"],
    queryFn: () => unwrap(api.users.members.$get()),
  })
  const members: Array<Member> = membersData ?? []

  const { data: ratesData } = useQuery({
    queryKey: ["exchange-rates", "latest"],
    queryFn: () => unwrap(api["exchange-rates"].latest.$get()),
  })
  const latestRates = ratesData?.rates ?? {}

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["categories", "usage"] })
    options?.onSuccess?.()
  }

  const createMutation = useMutation({
    mutationFn: (body: {
      accountId: string
      type: "expense" | "income"
      amount: number
      categoryId: string
      date: string
      note?: string
      settled?: boolean
      madeById?: string
    }) => unwrap(api.transactions.$post({ json: body })),
    onSuccess: invalidateAll,
  })
  const createTransferMutation = useMutation({
    mutationFn: (body: {
      fromAccountId: string
      toAccountId: string
      amount: number
      date: string
      note?: string
      originalAmount?: number
      originalCurrency?: string
      exchangeRate?: number
      madeById?: string
    }) => unwrap(api.transactions.transfers.$post({ json: body })),
    onSuccess: invalidateAll,
  })

  async function handleSubmitTransaction(data: {
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note?: string
    settled?: boolean
    madeById?: string
  }) {
    await createMutation.mutateAsync({
      ...data,
      type: data.type as "expense" | "income",
    })
  }

  async function handleSubmitTransfer(data: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date: string
    note?: string
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
    madeById?: string
  }) {
    await createTransferMutation.mutateAsync(data)
  }

  const dialog = (
    <TransactionFormDialog
      open={open}
      onOpenChange={setOpen}
      accounts={accountsForForm}
      wallets={wallets}
      categories={categories}
      members={members}
      currentUserId={currentUserId}
      exchangeRates={latestRates}
      defaultAccountId={defaultAccountId}
      accountUsage={accountUsage}
      categoryUsage={categoryUsage}
      onSubmitTransaction={handleSubmitTransaction}
      onSubmitTransfer={handleSubmitTransfer}
    />
  )

  return {
    openCreate: () => setOpen(true),
    dialog,
  }
}
