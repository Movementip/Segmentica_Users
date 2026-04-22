export interface MissingProduct {
    id: number;
    товар_id: number;
    товар_название: string;
    товар_артикул: string;
    необходимое_количество: number;
    текущее_количество: number;
    недостача: number;
    категория?: string;
    последняя_поставка?: string;
}
