import { useMutation } from "@tanstack/react-query"
import type { ImportTradesResponse } from "@workspace/api-contract"

import { queryClient } from "@/lib/api"

async function callImport(body: {
  files: Array<File>
  accountId: string
  dryRun: boolean
}): Promise<ImportTradesResponse> {
  const texts = await Promise.all(body.files.map((f) => f.text()))
  const merged = texts.join("\n\n")
  const blob = new Blob([merged], { type: "text/csv" })
  const fd = new FormData()
  fd.append("file", blob, "merged.csv")
  fd.append("accountId", body.accountId)
  fd.append("dryRun", body.dryRun ? "true" : "false")
  const res = await fetch("/api/trades/import", {
    method: "POST",
    credentials: "include",
    body: fd,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || "Import failed")
  }
  return res.json()
}

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: ["positions"] })
  queryClient.invalidateQueries({ queryKey: ["trades"] })
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["investments-summary"] })
}

export function useIbkrImportPreview() {
  return useMutation({
    mutationFn: (vars: { files: Array<File>; accountId: string }) =>
      callImport({ ...vars, dryRun: true }),
  })
}

export function useIbkrImportCommit() {
  return useMutation({
    mutationFn: (vars: { files: Array<File>; accountId: string }) =>
      callImport({ ...vars, dryRun: false }),
    onSuccess: invalidateAll,
  })
}
