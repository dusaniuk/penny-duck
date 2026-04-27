import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { tsr } from "@/lib/api"

export const Route = createFileRoute("/invite")({
  validateSearch: (search: Record<string, unknown>): { code: string } => ({
    code: String(search.code ?? ""),
  }),
  component: InvitePage,
})

function InvitePage() {
  const { code } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [inviteInvalid, setInviteInvalid] = useState(false)

  useEffect(() => {
    if (!code) {
      setInviteLoading(false)
      setInviteInvalid(true)
      return
    }

    fetch(`/api/auth/invite?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (res.ok) return res.json()
        setInviteInvalid(true)
        return null
      })
      .then((data) => {
        if (data?.organizationName) {
          setOrgName(data.organizationName)
        } else {
          setInviteInvalid(true)
        }
      })
      .catch(() => setInviteInvalid(true))
      .finally(() => setInviteLoading(false))
  }, [code])

  const signupMutation = tsr.auth.signup.useMutation()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      await signupMutation.mutateAsync({
        body: { name, email, password, inviteCode: code },
      })
      setSuccess(true)
    } catch {
      setError("Something went wrong, please try again")
    }
  }

  if (inviteLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (inviteInvalid) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invalid invite link</CardTitle>
              <CardDescription>
                This invite link is invalid or has expired. Ask the organization
                owner for a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/signup">Go to signup</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account created!</CardTitle>
              <CardDescription>
                And now pretend that you verified your account via email. Real
                verification will be added soon. For now, just go to{" "}
                <Link to="/login" className="underline">
                  login
                </Link>
                .
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>You've been invited!</CardTitle>
            <CardDescription>
              Join{" "}
              <span className="font-semibold text-foreground">{orgName}</span>{" "}
              on Penny Duck
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                  />
                </Field>
                <Field>
                  <Button
                    type="submit"
                    disabled={signupMutation.isPending}
                    className="w-full"
                  >
                    {signupMutation.isPending
                      ? "Creating account..."
                      : `Join ${orgName}`}
                  </Button>
                  <FieldDescription className="text-center">
                    Already have an account? <Link to="/login">Log in</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
