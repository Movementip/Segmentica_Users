import {
  getClientContragentTypeLabel,
  getClientContragentTypeTheme,
} from "@/lib/clientContragents"
import { cn } from "@/lib/utils"

import styles from "./ClientTypeBadge.module.css"

type ClientTypeBadgeProps = {
  value?: string | null
}

export function ClientTypeBadge({ value }: ClientTypeBadgeProps) {
  const theme = getClientContragentTypeTheme(value)

  return (
    <span className={cn(styles.badge)} data-theme={theme}>
      {getClientContragentTypeLabel(value || "")}
    </span>
  )
}
