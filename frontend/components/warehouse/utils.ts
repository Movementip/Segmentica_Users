import type { StockStatus } from "@/types/pages/warehouse"

export function getWarehouseStockStatusLabel(status: StockStatus | string): string {
  switch ((status || "").trim().toLowerCase()) {
    case "critical":
      return "Критический"
    case "low":
      return "Низкий"
    default:
      return "Нормальный"
  }
}

export function getWarehouseStockStatusTone(status: StockStatus | string) {
  switch ((status || "").trim().toLowerCase()) {
    case "critical":
      return "danger" as const
    case "low":
      return "warning" as const
    default:
      return "success" as const
  }
}

export function isWarehouseIncomingMovement(type: string): boolean {
  const normalized = (type || "").trim().toLowerCase()

  return (
    normalized === "приход" ||
    normalized === "поступление" ||
    normalized.includes("приход") ||
    normalized.includes("поступ")
  )
}

export function getWarehouseMovementBadgeTone(type: string) {
  const normalized = (type || "").trim().toLowerCase()

  if (normalized.includes("инвентар")) return "neutral" as const
  if (normalized.includes("спис")) return "warning" as const
  if (isWarehouseIncomingMovement(normalized)) return "success" as const
  return "danger" as const
}

export function getWarehouseMovementSignedQuantity(type: string, quantity: number): string {
  const abs = Math.abs(Number(quantity) || 0)
  return `${isWarehouseIncomingMovement(type) ? "+" : "-"}${abs}`
}
