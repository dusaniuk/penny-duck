import { useState } from "react"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"

import { IbkrImportPreviewStep } from "./ibkr-import-preview-step"
import { IbkrImportUploadStep } from "./ibkr-import-upload-step"
import { useIbkrImportCommit, useIbkrImportPreview } from "./use-ibkr-import"
import type { Account, ImportTradesResponse } from "@workspace/api-contract"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Array<Account>
}

type State =
  | { step: "upload"; error: string | null }
  | {
      step: "preview"
      result: ImportTradesResponse
      files: Array<File>
      accountId: string
      error: string | null
    }

export function IbkrImportDialog({ open, onOpenChange, accounts }: Props) {
  const [state, setState] = useState<State>({ step: "upload", error: null })
  const preview = useIbkrImportPreview()
  const commit = useIbkrImportCommit()

  function reset() {
    setState({ step: "upload", error: null })
  }

  async function handlePreview(files: Array<File>, accountId: string) {
    try {
      const result = await preview.mutateAsync({ files, accountId })
      setState({ step: "preview", result, files, accountId, error: null })
    } catch (err) {
      setState({ step: "upload", error: (err as Error).message })
    }
  }

  async function handleCommit() {
    if (state.step !== "preview") return
    try {
      await commit.mutateAsync({
        files: state.files,
        accountId: state.accountId,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setState({ ...state, error: (err as Error).message })
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <ResponsiveDialogContent
        className={state.step === "preview" ? "sm:max-w-3xl" : undefined}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {state.step === "upload" ? "Import from IBKR" : "Review import"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {state.step === "upload" ? (
          <IbkrImportUploadStep
            accounts={accounts}
            onPreview={handlePreview}
            submitting={preview.isPending}
            error={state.error}
          />
        ) : (
          <IbkrImportPreviewStep
            result={state.result}
            onConfirm={handleCommit}
            onBack={reset}
            submitting={commit.isPending}
            error={state.error}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
