import { useEffect, useRef, useState } from "react"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"

interface ApiKeyCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<string>
}

export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: ApiKeyCreateDialogProps) {
  const [name, setName] = useState("")
  const [key, setKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  }, [open])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setKey(null)
      setError(null)
      setCopied(false)
      setCopyError(false)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    try {
      const created = await onCreate(trimmed)
      if (!openRef.current) return
      setKey(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the key")
    } finally {
      setPending(false)
    }
  }

  async function handleCopy() {
    if (!key) return
    try {
      await navigator.clipboard.writeText(key)
      setCopyError(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {key ? "Your new key" : "Create key"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {key
              ? "Copy it now. You will not be able to see it again."
              : "Name the device that will use this key."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {key ? (
          <div className="space-y-2 p-4 pt-0">
            <div className="flex gap-2">
              <Input
                aria-label="API key"
                value={key}
                readOnly
                className="flex-1 font-mono text-base"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy key"
                onClick={handleCopy}
              >
                {copied ? (
                  <IconCheck className="size-4" />
                ) : (
                  <IconCopy className="size-4" />
                )}
              </Button>
            </div>
            {copyError && (
              <p className="text-sm text-destructive">
                Couldn't copy. Select the key and copy it manually.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 pt-0">
            <Field>
              <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. iPhone"
                maxLength={32}
                className="text-base"
                autoFocus
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !name.trim()}>
                Create
              </Button>
            </div>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
