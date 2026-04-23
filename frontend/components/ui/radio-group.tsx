import * as React from "react"

import { cn } from "@/lib/utils"

type RadioGroupContextValue = {
  disabled?: boolean
  name: string
  onValueChange?: (value: string) => void
  value?: string
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

function RadioGroup({
  className,
  disabled,
  name,
  onValueChange,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  disabled?: boolean
  name?: string
  onValueChange?: (value: string) => void
  value?: string
}) {
  const generatedName = React.useId()

  return (
    <RadioGroupContext.Provider
      value={{
        disabled,
        name: name ?? generatedName,
        onValueChange,
        value,
      }}
    >
      <div
        role="radiogroup"
        data-slot="radio-group"
        data-disabled={disabled ? "true" : undefined}
        className={cn("grid gap-2", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
}

function RadioGroupItem({
  checked,
  className,
  disabled,
  id,
  onChange,
  onKeyDown,
  value,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "checked"> & {
  checked?: boolean
  value: string
}) {
  const context = React.useContext(RadioGroupContext)
  const isChecked = checked ?? context?.value === value
  const isDisabled = Boolean(disabled ?? context?.disabled)

  return (
    <input
      id={id}
      type="radio"
      name={context?.name}
      value={value}
      checked={isChecked}
      disabled={isDisabled}
      aria-checked={isChecked}
      data-slot="radio-group-item"
      data-state={isChecked ? "checked" : "unchecked"}
      className={cn(
        "peer size-4 shrink-0 appearance-none rounded-full border border-input bg-background outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        "checked:border-primary checked:bg-[radial-gradient(circle,var(--primary)_0_42%,transparent_48%)] dark:bg-input/30",
        className
      )}
      onChange={(event) => {
        onChange?.(event)
        if (event.target.checked) {
          context?.onValueChange?.(value)
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)

        if (event.defaultPrevented) return
        if (event.key !== " " && event.key !== "Enter") return

        event.preventDefault()
        if (!isDisabled) {
          context?.onValueChange?.(value)
        }
      }}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
