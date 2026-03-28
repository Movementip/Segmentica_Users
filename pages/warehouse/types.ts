export type StockStatus = 'critical' | 'low' | 'normal';

export interface WarehouseItem {
    id: number;
    товар_id: number;
    количество: number;
    дата_последнего_поступления: string | null;
    updated_at: string;
    товар_название: string;
    товар_артикул: string;
    товар_категория: string;
    товар_единица: string;
    товар_мин_остаток: number;
    товар_цена_закупки: number;
    товар_цена_продажи: number;
    stock_status: StockStatus;
}

export interface Movement {
    id: number;
    товар_id: number;
    тип_операции: string;
    количество: number;
    дата_операции: string;
    заявка_id: number | null;
    закупка_id: number | null;
    комментарий: string | null;
    товар_название: string;
    товар_артикул: string;
    заявка_номер: number | null;
    закупка_номер: number | null;
}

export interface WarehouseData {
    warehouse: WarehouseItem[];
    movements: Movement[];
    lowStock: WarehouseItem[];
}
