import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { IconCheck, IconCopy, IconUserPlus } from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Input } from "@workspace/ui/components/input"
import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export const Route = createFileRoute("/settings/members")({
  component: MembersPage,
})

function MembersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await api.users.members.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const members = data ?? []

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.users.me.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const currentUser = meData ?? null
  const currentMember = members.find((m) => m.id === currentUser?.id)
  const isOwner = currentMember?.role === "owner"

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="text-base text-muted-foreground">
            People in your organization
          </p>
        </div>
        {isOwner && <InviteButton />}
      </div>

      {isLoading ? (
        <p className="text-base text-muted-foreground">Loading...</p>
      ) : (
        <div className="divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-3">
              <Avatar>
                <AvatarFallback>
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{member.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.email}
                </p>
              </div>
              <Badge variant="secondary">{member.role}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InviteButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.invites.$post()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  function handleOpen() {
    setOpen(true)
    setCopied(false)
    if (!generateMutation.data) {
      generateMutation.mutate()
    }
  }

  const inviteUrl = generateMutation.data?.inviteUrl ?? null

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <IconUserPlus />
        Invite
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Invite people</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Share this link to invite people to your organization
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex gap-2 p-4 pt-0">
            {generateMutation.isPending ? (
              <p className="text-base text-muted-foreground">
                Generating link...
              </p>
            ) : inviteUrl ? (
              <>
                <Input value={inviteUrl} readOnly className="flex-1" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <IconCheck className="size-4" />
                  ) : (
                    <IconCopy className="size-4" />
                  )}
                </Button>
              </>
            ) : (
              <p className="text-base text-destructive">
                Failed to generate invite link
              </p>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
