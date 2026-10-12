import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
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
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "@tanstack/react-query"
import { GoogleButton } from "@/components/auth/google-button"
import { TermsNotice } from "@/components/auth/terms-notice"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  component: LoginPage,
})

function oauthErrorMessage(code: string | undefined) {
  if (!code) return null
  if (code === "account_not_linked") {
    return "This email already has a password account. Log in with your password."
  }
  return "Google sign-in failed. Please try again."
}

function LoginPage() {
  const navigate = useNavigate()
  const { error: oauthError } = Route.useSearch()
  const [error, setError] = useState<string | null>(
    oauthErrorMessage(oauthError)
  )

  const loginMutation = useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { error: authError } = await authClient.signIn.email(body)
      if (authError) throw authError
    },
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      await loginMutation.mutateAsync({ email, password })
      navigate({ to: "/dashboard" })
    } catch (err) {
      setError(authErrorMessage(err as { code?: string }, "Login failed"))
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Field>
                <GoogleButton onError={setError} />
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                or
              </FieldSeparator>
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
                <Input id="password" name="password" type="password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>
                <TermsNotice action="continuing" />
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
