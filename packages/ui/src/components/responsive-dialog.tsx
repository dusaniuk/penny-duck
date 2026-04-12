import * as React from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerContent>
        <div
          className={cn("flex-1 min-h-0 overflow-y-auto px-4 pb-4", className)}
          {...props}
        >
          {children}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerHeader className={className} {...props} />
  }

  return <DialogHeader className={className} {...props} />
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerFooter className={className} {...props} />
  }

  return <DialogFooter className={className} {...props} />
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTitle className={className} {...props} />
  }

  return <DialogTitle className={className} {...props} />
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerDescription className={className} {...props} />
  }

  return <DialogDescription className={className} {...props} />
}

function ResponsiveDialogClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerClose {...props} />
  }

  return <DialogClose {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
}
