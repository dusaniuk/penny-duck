import { createFileRoute } from "@tanstack/react-router"
import TermsContent from "@/content/legal/terms.mdx"

export const Route = createFileRoute("/_public/legal/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — Penny Duck" }],
  }),
  component: TermsPage,
})

function TermsPage() {
  return <TermsContent />
}
