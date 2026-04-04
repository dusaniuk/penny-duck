import { createFileRoute, redirect } from "@tanstack/react-router"
import { getAuthUser } from "@/lib/auth"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getAuthUser()
    if (user) {
      throw redirect({ to: "/dashboard" })
    }
    throw redirect({ to: "/login" })
  },
})
