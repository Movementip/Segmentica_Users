import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function HeaderSearchPanel({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-[calc(100%+0.5rem)] z-[1000] animate-in fade-in-0 slide-in-from-top-1 duration-150",
        className
      )}
      {...props}
    >
      <Card
        size="sm"
        className="w-full rounded-2xl border-border bg-popover text-popover-foreground shadow-[var(--app-menu-shadow)]"
      >
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto p-3">{children}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeaderSearchExampleChip({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-9 rounded-full border-border bg-background px-4 text-sm font-semibold text-foreground",
        "hover:bg-[var(--chrome-hover)] hover:text-[var(--chrome-foreground)]",
        "focus-visible:bg-[var(--chrome-hover)] focus-visible:text-[var(--chrome-foreground)]",
        className
      )}
      {...props}
    />
  )
}

function HeaderSearchResultRow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cursor-pointer rounded-xl px-3 py-3 transition-colors",
        "hover:bg-[var(--chrome-hover)] focus-visible:bg-[var(--chrome-hover)]",
        className
      )}
      {...props}
    />
  )
}

export {
  HeaderSearchExampleChip,
  HeaderSearchPanel,
  HeaderSearchResultRow,
}
