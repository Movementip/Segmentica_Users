export interface Purchase {
    id: number
    поставщик_id: number
    поставщик_название?: string
    поставщик_телефон?: string
    поставщик_email?: string
    заявка_id?: number
    дата_заказа: string
    дата_поступления?: string
    статус: string
    общая_сумма: number
}

export interface Supplier {
    id: number
    название: string
    телефон: string
    email: string
}

export type AttachmentSummaryItem = {
    entity_id: number
    types: string[]
}

export type SupplierOption = {
    id: number
    name: string
}

export type PurchasesFiltersState = {
    status: string
    supplierId: string
    supplierName: string
    orderId: string
    sortBy: string
}
