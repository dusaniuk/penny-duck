import { queryClient, tsr } from "@/lib/api"

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: ["positions"] })
  queryClient.invalidateQueries({ queryKey: ["trades"] })
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["investments-summary"] })
}

export function useTradeCreate() {
  return tsr.investments.createTrade.useMutation({ onSuccess: invalidateAll })
}

export function useTradeUpdate() {
  return tsr.investments.updateTrade.useMutation({ onSuccess: invalidateAll })
}

export function useTradeDelete() {
  return tsr.investments.deleteTrade.useMutation({ onSuccess: invalidateAll })
}
