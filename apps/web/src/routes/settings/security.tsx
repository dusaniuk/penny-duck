import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { Session } from "@workspace/api-contract"
import { api, unwrap } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import { describeDevice, parseUserAgent } from "@/lib/user-agent"
import { SignOutOthersDialog } from "@/components/settings/sign-out-others-dialog"

export const Route = createFileRoute("/settings/security")({
  component: SecurityPage,
})

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function SecurityPage() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => unwrap(api.sessions.$get()),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.sessions[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      toast.success("Session signed out")
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to sign out")),
  })

  const revokeOthersMutation = useMutation({
    mutationFn: () => unwrap(api.sessions.others.$delete()),
    onSuccess: ({ revoked }) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      toast.success(
        revoked === 1
          ? "Signed out 1 other session"
          : `Signed out ${revoked} other sessions`
      )
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to sign out")),
  })

  const hasOthers = sessions.some((s) => !s.current)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Sessions</h2>
          <p className="text-base text-muted-foreground">
            Devices where you're signed in. Signed-out devices may stay active
            for up to 5 minutes.
          </p>
        </div>
        {hasOthers && (
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            Sign out others
          </Button>
        )}
      </div>

      {isError ? (
        <p className="text-base text-destructive">
          Couldn't load your sessions. Reload to try again.
        </p>
      ) : isLoading ? (
        <p className="text-base text-muted-foreground">Loading...</p>
      ) : (
        <div className="divide-y">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              pending={
                revokeMutation.isPending &&
                revokeMutation.variables === session.id
              }
              onRevoke={() => revokeMutation.mutate(session.id)}
            />
          ))}
        </div>
      )}

      <SignOutOthersDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => revokeOthersMutation.mutateAsync().then(() => {})}
      />
    </div>
  )
}

function SessionRow({
  session,
  pending,
  onRevoke,
}: {
  session: Session
  pending: boolean
  onRevoke: () => void
}) {
  const device = parseUserAgent(session.userAgent)
  const Icon = device.mobile ? IconDeviceMobile : IconDeviceDesktop
  const details = [
    session.ipAddress,
    `Signed in ${formatDate(session.createdAt)}`,
    `Last active ${formatDate(session.lastActiveAt)}`,
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-base font-medium">
          <span className="truncate">{describeDevice(device)}</span>
          {session.current && <Badge variant="secondary">This device</Badge>}
        </p>
        <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
      </div>
      {!session.current && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </div>
  )
}
