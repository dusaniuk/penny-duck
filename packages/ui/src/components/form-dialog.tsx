import * as React from "react"
import { useState } from "react"
import { IconX } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

const SHELL_BASE =
  "flex flex-col gap-[14px] bg-card text-foreground [font-family:Inter,system-ui,sans-serif] dark:bg-linear-to-b dark:from-[#131418] dark:to-[#0c0d10] dark:text-[#e8e8e8]"
const SHELL_DESKTOP =
  "w-[440px] rounded-[18px] border border-border p-[18px_18px_16px] shadow-[0_30px_80px_rgba(0,0,0,0.18)] dark:border-foreground/[0.06] dark:shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.02)]"
const SHELL_MOBILE =
  "min-h-dvh w-full px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),22px)]"

export const FORM_FIELD_LABEL =
  "text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground"

export const FORM_TRIGGER_ROW =
  "h-auto w-full rounded-[11px] border-border bg-foreground/[0.025] px-[11px] py-2.5 text-[13px] hover:bg-foreground/[0.04] dark:bg-foreground/[0.025] dark:hover:bg-foreground/[0.04]"

export const FORM_CANCEL_BUTTON =
  "h-auto rounded-[10px] border-foreground/10 bg-transparent px-[18px] py-[10px] text-[13px] text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"

export const FORM_SUBMIT_BUTTON =
  "h-auto rounded-[10px] px-[20px] py-[10px] text-[13px] font-semibold"

interface FormDialogContext {
  shellClass: string
  portalContainer: HTMLElement | null
  isMobile: boolean
  close: () => void
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: (ctx: FormDialogContext) => React.ReactNode
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
}: FormDialogProps) {
  const isMobile = useIsMobile()
  const [contentEl, setContentEl] = useState<HTMLElement | null>(null)

  const shellClass = cn(SHELL_BASE, isMobile ? SHELL_MOBILE : SHELL_DESKTOP)
  const close = () => onOpenChange(false)
  const ctx: FormDialogContext = {
    shellClass,
    portalContainer: contentEl,
    isMobile,
    close,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setContentEl}
        showCloseButton={false}
        className={cn(
          "gap-0 rounded-none border-0 bg-transparent p-0 ring-0",
          isMobile
            ? "top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4"
            : "w-[440px] max-w-none"
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {isMobile ? (
          // Scroll lives on this inner flex wrapper rather than on the Dialog
          // content. Touch scrolling on iOS Safari is more reliable here than
          // on a position:fixed h-dvh container, and overflow-x-hidden
          // localises any rogue horizontal overflow without clipping the
          // scroll axis.
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {children(ctx)}
          </div>
        ) : (
          children(ctx)
        )}
      </DialogContent>
    </Dialog>
  )
}

interface FormDialogHeaderProps {
  onClose: () => void
  children: React.ReactNode
}

export function FormDialogHeader({ onClose, children }: FormDialogHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close"
        className="size-[30px] bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
      >
        <IconX size={16} />
      </Button>
    </div>
  )
}

interface FormDialogFooterProps {
  isMobile: boolean
  error?: string | null
  children: React.ReactNode
}

export function FormDialogFooter({
  isMobile,
  error,
  children,
}: FormDialogFooterProps) {
  return (
    <>
      {error && (
        <p className="-mt-1 text-right text-[12px] text-destructive">{error}</p>
      )}
      <div className={cn("flex items-center gap-2 pt-1.5", isMobile && "pt-2")}>
        {children}
      </div>
    </>
  )
}
