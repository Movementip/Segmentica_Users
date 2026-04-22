import * as React from "react"
import { FiSearch } from "react-icons/fi"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type DataSearchFieldProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string
  onValueChange: (value: string) => void
  wrapperClassName?: string
}

function DataSearchField({
  value,
  onValueChange,
  className,
  wrapperClassName,
  ...props
}: DataSearchFieldProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 min-w-[250px] flex-1 items-center gap-2 rounded-xl border border-input bg-[var(--chrome)] px-3 font-sans text-sm font-medium text-[var(--chrome-foreground)] transition-colors",
        "hover:bg-[var(--chrome-hover)] focus-within:border-ring focus-within:bg-[var(--chrome-hover)] focus-within:ring-3 focus-within:ring-ring/30",
        wrapperClassName
      )}
    >
      <FiSearch className="size-4 shrink-0 text-[color-mix(in_oklab,var(--chrome-foreground)_68%,transparent)]" />
      <Input
        className={cn(
          "h-full flex-1 border-0 bg-transparent p-0 font-sans text-sm font-medium text-[var(--chrome-foreground)] shadow-none placeholder:text-[color-mix(in_oklab,var(--chrome-foreground)_58%,transparent)] focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
          className
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        name="site_query"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
    </div>
  )
}

export { DataSearchField }
