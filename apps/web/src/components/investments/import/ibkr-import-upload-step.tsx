import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { FormEvent } from "react"
import type { Account } from "@workspace/api-contract"

interface Props {
  accounts: Array<Account>
  onPreview: (files: Array<File>, accountId: string) => Promise<void>
  submitting: boolean
  error: string | null
}

export function IbkrImportUploadStep({
  accounts,
  onPreview,
  submitting,
  error,
}: Props) {
  const [files, setFiles] = useState<Array<File>>([])
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (files.length === 0 || !accountId) return
    await onPreview(files, accountId)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        Upload one or more Activity Flex Query CSVs from IBKR. Trades,
        dividends, and cash deposits/withdrawals will be imported.
      </p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ibkr-file">CSV file</FieldLabel>
          <Input
            id="ibkr-file"
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(e) =>
              setFiles(Array.from(e.currentTarget.files ?? []))
            }
            required
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="ibkr-account">
            Target brokerage account
          </FieldLabel>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id="ibkr-account">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={files.length === 0 || !accountId || submitting}
      >
        {submitting ? "Parsing…" : "Preview import"}
      </Button>
    </form>
  )
}
