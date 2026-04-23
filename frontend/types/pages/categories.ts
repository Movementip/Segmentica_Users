export interface Category {
    id: number
    название: string
    описание?: string
    родительская_категория_id?: number
    родительская_категория_название?: string
    активна: boolean
    created_at: string
}

export interface CategoryTreeNode extends Category {
    children: CategoryTreeNode[]
    depth: number
}

export interface TreeColumn {
    parentId: number | null
    level: number
    nodes: CategoryTreeNode[]
}
