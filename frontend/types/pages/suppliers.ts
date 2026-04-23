import type { SupplierContragent } from "@/lib/supplierContragents"

export interface Supplier extends SupplierContragent {
    количество_товаров?: number
    общая_сумма_закупок?: number
    закупки_в_пути?: number
}

export type SupplierAttachmentSummaryItem = {
    entity_id: number
    types: string[]
}

export type SuppliersFiltersState = {
    inTransit: string
    supplierName: string
    type: string
    rating: string
    sortBy: SuppliersSortValue
}

export type SupplierOption = {
    id: number
    name: string
}

export type SuppliersSortValue =
    | "name-asc"
    | "name-desc"
    | "rating-desc"
    | "sum-desc"
    | "products-desc"
