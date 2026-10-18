import { useMutation } from "@tanstack/react-query"
import { api, queryClient, unwrap } from "@/lib/api"

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: ["positions"] })
  queryClient.invalidateQueries({ queryKey: ["trades"] })
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["investments-summary"] })
}

export function useTradeCreate() {
  return useMutation({
    mutationFn: (body: {
      accountId: string
      symbol: string
      type: "buy" | "sell" | "dividend"
      quantity?: number
      price?: number
      amount?: number
      fees?: number
      date: string
    }) => unwrap(api.trades.$post({ json: body })),
    onSuccess: invalidateAll,
  })
}

export function useTradeUpdate() {
  return useMutation({
    mutationFn: (vars: {
      id: string
      body: {
        symbol?: string
        quantity?: number
        price?: number
        amount?: number
        fees?: number
        date?: string
      }
    }) =>
      unwrap(
        api.trades[":id"].$patch({
          param: { id: vars.id },
          json: vars.body,
        })
      ),
    onSuccess: invalidateAll,
  })
}

export function useTradeDelete() {
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.trades[":id"].$delete({ param: { id } })),
    onSuccess: invalidateAll,
  })
}
