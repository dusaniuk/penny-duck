import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
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
import { getSignupOpen } from "@/lib/signup"

export const Route = createFileRoute("/_auth/signup")({
  beforeLoad: async () => {
    if (!(await getSignupOpen())) throw redirect({ to: "/login" })
  },
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const signupMutation = useMutation({
    mutationFn: async (body: {
      name: string
      email: string
      password: string
    }) => {
      const { error: authError } = await authClient.signUp.email(body)
      if (authError) throw authError
    },
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      await signupMutation.mutateAsync({ name, email, password })
      navigate({ to: "/dashboard" })
    } catch (err) {
      setError(authErrorMessage(err as { code?: string }, "Signup failed"))
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Enter your details below to get started
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
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  maxLength={100}
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
                <Input id="password" name="password" type="password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={signupMutation.isPending}>
                  {signupMutation.isPending ? "Creating account..." : "Sign up"}
                </Button>
                <TermsNotice action="creating an account" />
                <FieldDescription className="text-center">
                  Already have an account? <Link to="/login">Log in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
