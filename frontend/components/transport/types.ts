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

export const defaultTransportFilters: TransportFiltersState = {
  companyName: "",
  rate: "all",
  totalShipments: "all",
  activeShipments: "all",
  sortBy: "shipments-desc",
}

export const transportRateOptions = [
  { value: "all", label: "Все тарифы" },
  { value: "lt-1000", label: "Меньше 1 000 ₽" },
  { value: "1000-5000", label: "1 000–5 000 ₽" },
  { value: "gt-5000", label: "Больше 5 000 ₽" },
] as const

export const transportTotalShipmentOptions = [
  { value: "all", label: "Любое количество" },
  { value: "0", label: "0" },
  { value: "1-9", label: "1–9" },
  { value: "10+", label: "10+" },
] as const

export const transportActiveShipmentOptions = [
  { value: "all", label: "Любое количество" },
  { value: "0", label: "0" },
  { value: "1-4", label: "1–4" },
  { value: "5+", label: "5+" },
] as const

export const transportSortOptions = [
  { value: "shipments-desc", label: "По отгрузкам (сначала больше)" },
  { value: "shipments-asc", label: "По отгрузкам (сначала меньше)" },
  { value: "revenue-desc", label: "По выручке (сначала больше)" },
  { value: "revenue-asc", label: "По выручке (сначала меньше)" },
  { value: "created-desc", label: "По дате (сначала новые)" },
  { value: "created-asc", label: "По дате (сначала старые)" },
] as const
