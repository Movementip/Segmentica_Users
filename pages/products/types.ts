export interface Product {
    id: number;
    название: string;
    артикул: string;
    категория_id?: number;
    описание?: string;
    цена: number;
    единица_измерения: string;
    категория_название?: string;
    created_at?: string;
}
