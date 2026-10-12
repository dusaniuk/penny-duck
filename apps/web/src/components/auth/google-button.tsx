import { useEffect, useState } from "react"
import { IconBrandGoogle } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

export function GoogleButton({
  inviteCode,
  onError,
}: {
  inviteCode?: string
  onError: (message: string) => void
}) {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(false)
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  async function handleClick() {
    setPending(true)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
      ...(inviteCode ? { additionalData: { inviteCode } } : {}),
    })
    if (error) {
      onError(authErrorMessage(error, "Google sign-in failed"))
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={handleClick}
    >
      <IconBrandGoogle />
      Continue with Google
    </Button>
  )
}
