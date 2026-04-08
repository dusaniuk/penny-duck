export interface TransactionData {
  id: string
  accountId: string | null
  type: string
  amount: number
  categoryId: string | null
  note: string | null
  date: string
  myShare: number | null
  settled: boolean
  originalAmount: number | null
  originalCurrency: string | null
  exchangeRate: number | null
  transferId: string | null
  createdAt: string
  updatedAt: string
}

export interface TransactionFilters {
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  orphaned?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface AccountData {
  id: string
  name: string
  type: string
  currency: string
  balance: number
}

export interface CategoryData {
  id: string
  name: string
  parentId: string | null
  icon: string | null
}
