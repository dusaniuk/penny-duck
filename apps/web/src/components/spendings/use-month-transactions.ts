import { useQuery } from "@tanstack/react-query"
import type { Transaction } from "@workspace/api-contract"
import { api, unwrap } from "@/lib/api"

const PAGE_SIZE = 100

function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  }
}

async function fetchAllTransactions(
  year: number,
  month: number
): Promise<Array<Transaction>> {
  const { dateFrom, dateTo } = getMonthRange(year, month)
  const all: Array<Transaction> = []
  let page = 1

  while (true) {
    const body = await unwrap(
      api.transactions.$get({
        query: {
          dateFrom,
          dateTo,
          type: "expense",
          limit: String(PAGE_SIZE),
          page: String(page),
        },
      })
    )
    all.push(...body.data)

    if (all.length >= body.total) break
    page++
  }

  return all
}

export function useMonthTransactions(year: number, month: number) {
  return useQuery({
    queryKey: ["spendings", "transactions", year, month],
    queryFn: () => fetchAllTransactions(year, month),
  })
}
