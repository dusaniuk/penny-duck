import { Link } from "@tanstack/react-router"
import { IconCashBanknote } from "@tabler/icons-react"
import type { ReactNode } from "react"
import { Footer } from "@/components/footer"

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-2 border-b px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <IconCashBanknote className="size-5" />
          Penny Duck
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        {children}
      </main>
      <Footer />
    </div>
  )
}
