import {
  getClientContragentTypeLabel,
  getClientContragentTypeTheme,
} from "@/lib/clientContragents"
import { ContragentTypeBadge } from "@/components/contragents/ContragentTypeBadge/ContragentTypeBadge"

type ClientTypeBadgeProps = {
  value?: string | null
}

export function ClientTypeBadge({ value }: ClientTypeBadgeProps) {
  return (
    <ContragentTypeBadge
      label={getClientContragentTypeLabel(value || "")}
      theme={getClientContragentTypeTheme(value)}
    />
  )
}
