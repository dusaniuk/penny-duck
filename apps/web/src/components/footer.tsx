import { Link } from "@tanstack/react-router"

export function Footer() {
  return (
    <footer className="flex items-center justify-center gap-4 py-6 text-sm text-muted-foreground">
      <span>&copy; {new Date().getFullYear()} Penny Duck</span>
      <span aria-hidden="true">&middot;</span>
      <Link to="/legal/terms" className="hover:text-foreground">
        Terms of Service
      </Link>
      <span aria-hidden="true">&middot;</span>
      <Link to="/legal/privacy" className="hover:text-foreground">
        Privacy Policy
      </Link>
    </footer>
  )
}
