import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"

export function useInboxPendingCount(): number {
  const { data } = useQuery({
    queryKey: ["inbox", "pending-count"],
    queryFn: () =>
      unwrap(
        api.inbox.$get({
          query: { status: "pending", limit: "1" },
        })
      ),
  })
  return data?.total ?? 0
}
