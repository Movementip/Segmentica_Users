export interface Purchase {
    id: number;
    поставщик_id: number;
    дата_создания: string;
    дата_поставки?: string;
    статус: string;
    общая_сумма: number;
    поставщик_название?: string;
    комментарий?: string;
}
