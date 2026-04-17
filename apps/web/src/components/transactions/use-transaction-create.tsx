import { useState } from "react"
import type { Account, Category, Member } from "@workspace/api-contract"
import { queryClient, tsr } from "@/lib/api"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"

interface UseTransactionCreateOptions {
  onSuccess?: () => void
}

export function useTransactionCreate(options?: UseTransactionCreateOptions) {
  const [open, setOpen] = useState(false)

  const { data: accountsData } = tsr.accounts.list.useQuery({
    queryKey: ["accounts"],
  })
  const accounts: Array<Account> = accountsData?.body ?? []

  const { data: categoriesData } = tsr.categories.list.useQuery({
    queryKey: ["categories"],
  })
  const categories: Array<Category> = categoriesData?.body ?? []

  const { data: meData } = tsr.users.getMe.useQuery({
    queryKey: ["users", "me"],
  })
  const currentUserId = meData?.body.id ?? ""

  const { data: membersData } = tsr.users.getMembers.useQuery({
    queryKey: ["users", "members"],
  })
  const members: Array<Member> = membersData?.body ?? []

  const { data: ratesData } = tsr.exchangeRates.latest.useQuery({
    queryKey: ["exchange-rates", "latest"],
  })
  const latestRates = ratesData?.body.rates ?? {}

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    options?.onSuccess?.()
  }

  const createMutation = tsr.transactions.create.useMutation({
    onSuccess: invalidateAll,
  })
  const createTransferMutation = tsr.transactions.createTransfer.useMutation({
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
      body: {
        ...data,
        type: data.type as "expense" | "income",
      },
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
    await createTransferMutation.mutateAsync({ body: data })
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
      onSubmitTransaction={handleSubmitTransaction}
      onSubmitTransfer={handleSubmitTransfer}
    />
  )

  return {
    openCreate: () => setOpen(true),
    dialog,
  }
}
