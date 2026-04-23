import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange?.(false)
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onOpenChange, open])

  if (!open || !mounted || typeof document === "undefined") return null

  return createPortal(
    <div
      data-slot="dialog-overlay"
      className="fixed inset-0 z-[1000] overflow-y-auto bg-black/55 backdrop-blur-md backdrop-saturate-75"
      onMouseDown={() => onOpenChange?.(false)}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        {children}
      </div>
    </div>,
    document.body
  )
}

function DialogContent({
  className,
  onMouseDown,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-slot="dialog-content"
      data-scroll-lock-allow="true"
      className={cn(
        "w-full max-w-lg rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-[var(--app-menu-shadow)]",
        className
      )}
      onMouseDown={(event) => {
        event.stopPropagation()
        onMouseDown?.(event)
      }}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
