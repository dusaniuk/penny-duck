import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useInboxPendingCount(): number {
  const { data } = useQuery({
    queryKey: ["inbox", "pending-count"],
    queryFn: async () => {
      const res = await api.inbox.$get({
        query: { status: "pending", limit: "1" },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  return data?.total ?? 0
}
