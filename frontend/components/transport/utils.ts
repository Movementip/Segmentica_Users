import { getEntityStatusTone } from "@/lib/entityStatuses"

export function getTransportShipmentStatusTone(
  status: string
) {
  return getEntityStatusTone(status)
}

export function getTransportShipmentStatusLabel(status: string) {
  return (status || "Не определено").trim()
}
