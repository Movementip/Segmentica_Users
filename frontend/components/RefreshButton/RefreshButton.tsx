import * as React from "react"
import { FiRefreshCw } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RefreshButtonProps = React.ComponentProps<typeof Button> & {
  isRefreshing?: boolean
  refreshKey?: React.Key
  iconClassName?: string
}

export function RefreshButton({
  className,
  children = "Обновить",
  isRefreshing = false,
  refreshKey,
  iconClassName,
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-10 min-w-[142px] rounded-xl border-border bg-[var(--chrome)] px-4 font-semibold text-[var(--chrome-foreground)] shadow-none",
        "hover:border-border hover:bg-[var(--chrome-hover)] hover:text-[var(--chrome-foreground)]",
        "active:translate-y-px",
        className
      )}
      {...props}
    >
      <FiRefreshCw
        key={refreshKey}
        data-icon="inline-start"
        className={cn("size-4", isRefreshing && iconClassName)}
      />
      {children}
    </Button>
  )
}
