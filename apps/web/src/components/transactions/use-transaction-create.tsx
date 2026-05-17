import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import type {
  Account,
  Category,
  CategoryUsageItem,
  Member,
} from "@workspace/api-contract"
import { api, queryClient } from "@/lib/api"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"

interface UseTransactionCreateOptions {
  onSuccess?: () => void
}

export function useTransactionCreate(options?: UseTransactionCreateOptions) {
  const [open, setOpen] = useState(false)

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts: Array<Account> = accountsData ?? []
  const defaultAccountId = accounts.find((a) => a.isDefault)?.id

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories: Array<Category> = categoriesData ?? []

  const { data: categoryUsageData } = useQuery({
    queryKey: ["categories", "usage"],
    queryFn: async () => {
      const res = await api.categories.usage.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categoryUsage: Array<CategoryUsageItem> = categoryUsageData ?? []

  const { data: meData } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await api.users.me.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const currentUserId = meData?.id ?? ""

  const { data: membersData } = useQuery({
    queryKey: ["users", "members"],
    queryFn: async () => {
      const res = await api.users.members.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const members: Array<Member> = membersData ?? []

  const { data: ratesData } = useQuery({
    queryKey: ["exchange-rates", "latest"],
    queryFn: async () => {
      const res = await api["exchange-rates"].latest.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const latestRates = ratesData?.rates ?? {}

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["categories", "usage"] })
    options?.onSuccess?.()
  }

  const createMutation = useMutation({
    mutationFn: async (body: {
      accountId: string
      type: "expense" | "income"
      amount: number
      categoryId: string
      date: string
      note?: string
      settled?: boolean
      madeById?: string
    }) => {
      const res = await api.transactions.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const createTransferMutation = useMutation({
    mutationFn: async (body: {
      fromAccountId: string
      toAccountId: string
      amount: number
      date: string
      note?: string
      originalAmount?: number
      originalCurrency?: string
      exchangeRate?: number
      madeById?: string
    }) => {
      const res = await api.transactions.transfers.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
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
      accounts={accounts}
      categories={categories}
      members={members}
      currentUserId={currentUserId}
      exchangeRates={latestRates}
      defaultAccountId={defaultAccountId}
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
