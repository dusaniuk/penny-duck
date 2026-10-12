import { Link } from "@tanstack/react-router"

export function TermsNotice({ action }: { action: string }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      By {action}, you agree to our{" "}
      <Link to="/legal/terms" className="underline hover:text-foreground">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link to="/legal/privacy" className="underline hover:text-foreground">
        Privacy Policy
      </Link>
      .
    </p>
  )
}
