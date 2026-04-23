export interface MissingProduct {
    id: number
    заявка_id: number
    товар_id: number
    необходимое_количество: number
    недостающее_количество: number
    статус: string
    товар_название?: string
    товар_артикул?: string
    created_at?: string
}

export interface MissingProductsProductOption {
    id: number
    название: string
    артикул: string
}

export interface MissingProductsOrderOption {
    id: number
}

export type MissingProductsSortValue =
    | "missing_desc"
    | "missing_asc"
    | "required_desc"
    | "required_asc"
    | "status"
    | "product"
    | "order"

export type MissingProductsFiltersState = {
    status: string
    orderId: string
    productId: string
    sortBy: MissingProductsSortValue
}

export type MissingProductFormData = {
    заявка_id: string
    товар_id: string
    необходимое_количество: string
    недостающее_количество: string
    статус: string
}
