import { useMutation } from "@tanstack/react-query"
import { api, queryClient } from "@/lib/api"

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: ["positions"] })
  queryClient.invalidateQueries({ queryKey: ["trades"] })
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["investments-summary"] })
}

export function useTradeCreate() {
  return useMutation({
    mutationFn: async (body: {
      accountId: string
      symbol: string
      type: "buy" | "sell" | "dividend"
      quantity?: number
      price?: number
      amount?: number
      fees?: number
      date: string
    }) => {
      const res = await api.trades.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
}

export function useTradeUpdate() {
  return useMutation({
    mutationFn: async (vars: {
      id: string
      body: {
        symbol?: string
        quantity?: number
        price?: number
        amount?: number
        fees?: number
        date?: string
      }
    }) => {
      const res = await api.trades[":id"].$patch({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
}

export function useTradeDelete() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.trades[":id"].$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
}
