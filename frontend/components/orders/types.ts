import type { OrderExecutionMode } from "@/lib/orderModes"

export interface Order {
  id: number
  клиент_id: number
  менеджер_id?: number
  режим_исполнения: OrderExecutionMode
  дата_создания: string
  дата_выполнения?: string
  статус: string
  общая_сумма: number
  адрес_доставки?: string
  клиент_название?: string
  менеджер_фио?: string
  can_create_purchase?: boolean
  can_assemble?: boolean
  can_create_shipment?: boolean
  can_complete?: boolean
  next_assembly_label?: string | null
  next_shipment_label?: string | null
  недостающие_товары?: Array<{
    статус: string
    недостающее_количество: number
  }>
}

export type AttachmentSummaryItem = {
  entity_id: number
  types: string[]
}

export interface LinkedPurchase {
  id: number
  статус?: string
  дата_заказа?: string
  общая_сумма?: number
}

export type ClientOption = { id: number; name: string }

export type OrdersFiltersState = {
  status: string
  executionMode: string
  sortBy: string
  clientId: string
  managerName: string
  clientName: string
}
