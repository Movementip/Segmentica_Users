export interface Manager {
    id: number
    фио: string
    должность: string
    телефон?: string
    email?: string
    ставка?: number
    дата_приема?: string
    активен: boolean
    created_at: string
}

export type ActivityFilter = "all" | "active" | "inactive"
export type SortOption =
    | "id-desc"
    | "id-asc"
    | "name-asc"
    | "name-desc"
    | "hire-desc"
    | "hire-asc"
