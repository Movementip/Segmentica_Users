export interface Order {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    клиент_название?: string;
    менеджер_фио?: string;
}
