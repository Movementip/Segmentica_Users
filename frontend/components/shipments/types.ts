export type Shipment = {
  id: number
  заявка_id: number | null
  использовать_доставку?: boolean
  без_учета_склада?: boolean
  транспорт_id: number | null
  статус: string
  номер_отслеживания: string | null
  дата_отгрузки: string
  стоимость_доставки: number | null
  заявка_номер?: string | number
  транспорт_название?: string
}

export type ShipmentsTab = "all" | "in_transit" | "delivered" | "canceled"

export type StatusFilter = "all" | "в пути" | "доставлено" | "получено" | "отменено"

export type ShipmentStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "muted"

export const shipmentStatusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "в пути", label: "В пути" },
  { value: "доставлено", label: "Доставлено" },
  { value: "получено", label: "Получено" },
  { value: "отменено", label: "Отменено" },
] as const

export function getShipmentStatusLabel(status: string) {
  const normalized = (status || "").trim().toLowerCase()

  switch (normalized) {
    case "в пути":
      return "В пути"
    case "доставлено":
      return "Доставлено"
    case "получено":
      return "Получено"
    case "отменено":
      return "Отменено"
    default:
      return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "Не определено"
  }
}

export function getShipmentStatusTone(status: string): ShipmentStatusTone {
  switch ((status || "").trim().toLowerCase()) {
    case "получено":
    case "доставлено":
      return "success"
    case "в пути":
      return "warning"
    case "отменено":
      return "danger"
    default:
      return "muted"
  }
}
