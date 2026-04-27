import { Link, createFileRoute } from "@tanstack/react-router"
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
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { tsr } from "@/lib/api"

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
})

function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
        body: { name, email, password },
      })
      setSuccess(true)
    } catch (err) {
      if (err && typeof err === "object" && "body" in err) {
        const body = (err as { body: { message?: string } }).body
        setError(body.message || "Signup failed")
      } else {
        setError("Signup failed")
      }
    }
  }

  if (success) {
    return (
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
    )
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
                <Input id="password" name="password" type="password" required />
              </Field>
              <Field>
                <Button type="submit" disabled={signupMutation.isPending}>
                  {signupMutation.isPending ? "Creating account..." : "Sign up"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link
                    to="/legal/terms"
                    className="underline hover:text-foreground"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/legal/privacy"
                    className="underline hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
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
