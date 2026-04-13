import { createFileRoute } from "@tanstack/react-router"
import PrivacyContent from "@/content/legal/privacy.mdx"

export const Route = createFileRoute("/_public/legal/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — Penny Duck" }],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return <PrivacyContent />
}
