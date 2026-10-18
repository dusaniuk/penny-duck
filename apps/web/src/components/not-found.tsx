import { Link } from "@tanstack/react-router"
import { IconArrowLeft } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@/components/page-header"
import { PublicShell } from "@/components/public-shell"

export function NotFound() {
  return (
    <PublicShell>
      <div className="flex flex-1 flex-col items-start justify-center gap-6 py-16">
        <PageHeader
          eyebrow="404"
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
        />
        <Button asChild size="lg">
          <Link to="/">
            <IconArrowLeft data-icon="inline-start" />
            Back to Penny Duck
          </Link>
        </Button>
      </div>
    </PublicShell>
  )
}
