import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({
  modal = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root modal={modal} {...props} />
}

function SelectTrigger({
  className,
  children,
  placeholder,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  placeholder?: React.ReactNode
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-[var(--chrome)] px-3 py-2 font-sans text-sm font-medium text-[var(--chrome-foreground)] shadow-none transition-colors outline-none",
        "hover:bg-[var(--chrome-hover)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring data-[popup-open]:bg-[var(--chrome-hover)] data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <SelectPrimitive.Value
            placeholder={placeholder}
            className="min-w-0 flex-1 truncate text-left text-[var(--chrome-foreground)] data-[placeholder]:text-[color-mix(in_oklab,var(--chrome-foreground)_58%,transparent)]"
          />
          <SelectPrimitive.Icon className="text-[color-mix(in_oklab,var(--chrome-foreground)_68%,transparent)]">
            <ChevronDown className="size-4" />
          </SelectPrimitive.Icon>
        </>
      )}
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "min-w-0 flex-1 truncate text-left text-[var(--chrome-foreground)] data-[placeholder]:text-[color-mix(in_oklab,var(--chrome-foreground)_58%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  align = "start",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> & {
  sideOffset?: number
  align?: "start" | "center" | "end"
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        alignItemWithTrigger={false}
        className="z-[120]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "segmentica-overlay max-h-80 min-w-[var(--anchor-width)] overflow-hidden rounded-2xl border bg-popover p-1 text-popover-foreground shadow-[var(--app-menu-shadow)] outline-none",
            "origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List className="max-h-80 overflow-y-auto">
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "segmentica-overlay-item relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 pr-8 text-sm outline-none transition-colors",
        "data-highlighted:bg-[var(--chrome-hover)] data-highlighted:text-[var(--chrome-foreground)] data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center justify-center">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}
