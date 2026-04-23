export interface Product {
    id: number
    название: string
    артикул: string
    категория?: string
    категория_id?: number
    категория_название?: string
    описание?: string
    цена?: number
    цена_закупки?: number
    цена_продажи: number
    единица_измерения: string
    минимальный_остаток: number
    created_at: string
}

export type ProductAttachmentSummaryItem = {
    entity_id: number
    types: string[]
}

export type ProductSortValue =
    | "date-desc"
    | "date-asc"
    | "name-asc"
    | "name-desc"
    | "price-purchase-asc"
    | "price-purchase-desc"
    | "price-sale-asc"
    | "price-sale-desc"

export type ProductFilters = {
    category: string
    unit: string
    sortBy: ProductSortValue
}

export type ProductImportResponse = {
    created_count?: number
    updated_count?: number
    skipped_count?: number
    error?: string
    message?: string
}
