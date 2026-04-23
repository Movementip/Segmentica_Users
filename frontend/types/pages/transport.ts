export type TransportCompany = {
    id: number
    название: string
    телефон: string | null
    email: string | null
    тариф: number | null
    created_at: string
    общее_количество_отгрузок: number
    активные_отгрузки: number
    завершенные_отгрузки: number
    средняя_стоимость: number | null
    общая_выручка: number | null
}

export type TransportShipment = {
    id: number
    заявка_id: number
    транспорт_id: number
    статус: string
    номер_отслеживания: string | null
    дата_отгрузки: string
    стоимость_доставки: number | null
    транспорт_название: string
    заявка_номер: number
    клиент_название: string
    заявка_статус: string
}

export type TransportData = {
    transport: TransportCompany[]
    recentShipments: TransportShipment[]
    activeShipments: TransportShipment[]
}

export type TransportPerformanceRow = {
    месяц: string
    количество_отгрузок: number
    успешные_доставки: number
    средняя_стоимость: number
    общая_выручка: number
}

export type TransportMonthShipmentRow = {
    id: number
    номер_отслеживания: string | null
    дата_отгрузки: string
    стоимость_доставки: number | null
    заявка_номер: number | null
    заявка_статус: string
    клиент_название: string
}

export type TransportStatsResponse = {
    transport: TransportCompany
    performance: TransportPerformanceRow[]
    periodTotals: {
        количество_отгрузок: number
        успешные_доставки: number
        средняя_стоимость: number
        общая_выручка: number
    }
}

export type TransportViewTab = "companies" | "activeShipments" | "recentShipments"

export type TransportFiltersState = {
    companyName: string
    rate: "all" | "lt-1000" | "1000-5000" | "gt-5000"
    totalShipments: "all" | "0" | "1-9" | "10+"
    activeShipments: "all" | "0" | "1-4" | "5+"
    sortBy:
        | "shipments-desc"
        | "shipments-asc"
        | "revenue-desc"
        | "revenue-asc"
        | "created-desc"
        | "created-asc"
}
