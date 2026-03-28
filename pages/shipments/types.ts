export interface Shipment {
    id: number;
    заказ_id: number;
    транспортная_компания_id: number;
    дата_отправки: string;
    дата_доставки?: string;
    статус: string;
    стоимость_доставки: number;
    адрес_доставки: string;
    заказ_номер?: string;
    транспортная_компания_название?: string;
}
