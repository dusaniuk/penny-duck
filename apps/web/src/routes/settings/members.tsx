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
import { tsr } from "@/lib/api"

export const Route = createFileRoute("/settings/members")({
  component: MembersPage,
})

function MembersPage() {
  const { data, isLoading } = tsr.users.getMembers.useQuery({
    queryKey: ["members"],
  })

  const members = data?.status === 200 ? data.body : []

  const { data: meData } = tsr.users.getMe.useQuery({
    queryKey: ["me"],
  })

  const currentUser = meData?.status === 200 ? meData.body : null
  const currentMember = members.find((m) => m.id === currentUser?.id)
  const isOwner = currentMember?.role === "owner"

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            People in your organization
          </p>
        </div>
        {isOwner && <InviteButton />}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
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
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
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

  const generateMutation = tsr.auth.generateInviteCode.useMutation()

  function handleOpen() {
    setOpen(true)
    setCopied(false)
    if (!generateMutation.data) {
      generateMutation.mutate({})
    }
  }

  const inviteUrl =
    generateMutation.data?.status === 200
      ? generateMutation.data.body.inviteUrl
      : null

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
              <p className="text-sm text-muted-foreground">
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
              <p className="text-sm text-destructive">
                Failed to generate invite link
              </p>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
