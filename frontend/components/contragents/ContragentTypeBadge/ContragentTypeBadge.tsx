import { cn } from "@/lib/utils"

import styles from "./ContragentTypeBadge.module.css"

export type ContragentTypeBadgeTheme =
  | "organization"
  | "entrepreneur"
  | "person"
  | "advocate"
  | "notary"
  | "farm"
  | "foreign"

type ContragentTypeBadgeProps = {
  className?: string
  label: string
  theme: ContragentTypeBadgeTheme
}

export function ContragentTypeBadge({
  className,
  label,
  theme,
}: ContragentTypeBadgeProps) {
  return (
    <span className={cn(styles.root, className)} data-theme={theme}>
      {label}
    </span>
  )
}
