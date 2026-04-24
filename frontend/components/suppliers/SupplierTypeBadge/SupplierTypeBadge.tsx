import { ContragentTypeBadge } from "@/components/contragents/ContragentTypeBadge/ContragentTypeBadge"
import {
  getSupplierContragentTypeLabel,
  getSupplierContragentTypeTheme,
} from "@/lib/supplierContragents"

type SupplierTypeBadgeProps = {
  className?: string
  value?: string | null
}

export function SupplierTypeBadge({
  className,
  value,
}: SupplierTypeBadgeProps) {
  return (
    <ContragentTypeBadge
      className={className}
      label={getSupplierContragentTypeLabel(value || "")}
      theme={getSupplierContragentTypeTheme(value)}
    />
  )
}
