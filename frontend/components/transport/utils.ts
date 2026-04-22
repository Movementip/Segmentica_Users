type TransportShipmentStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "muted"

export function getTransportShipmentStatusTone(
  status: string
): TransportShipmentStatusTone {
  switch ((status || "").trim().toLowerCase()) {
    case "получено":
    case "доставлено":
    case "отгружена":
    case "отгружено":
    case "выполнена":
    case "выполнено":
      return "success"
    case "в обработке":
    case "в пути":
      return "warning"
    case "отменена":
    case "отменено":
      return "danger"
    case "новая":
    case "подтверждена":
    case "подтверждено":
    case "в работе":
    case "собрана":
      return "neutral"
    default:
      return "muted"
  }
}

export function getTransportShipmentStatusLabel(status: string) {
  return (status || "Не определено").trim()
}
