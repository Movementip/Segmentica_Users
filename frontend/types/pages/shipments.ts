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
