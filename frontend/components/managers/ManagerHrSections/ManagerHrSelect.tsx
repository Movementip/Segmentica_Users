import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import styles from "./ManagerHrSections.module.css"

export type ManagerHrSelectOption = {
  value: string
  label: string
}

type ManagerHrSelectProps = {
  value: string
  options: ManagerHrSelectOption[]
  disabled?: boolean
  className?: string
  onValueChange: (value: string) => void
}

export function ManagerHrSelect({
  value,
  options,
  disabled,
  className,
  onValueChange,
}: ManagerHrSelectProps) {
  const activeLabel = options.find((option) => option.value === value)?.label

  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(String(nextValue))} disabled={disabled}>
      <SelectTrigger className={cn(styles.selectTrigger, className)}>
        <SelectValue>{activeLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
