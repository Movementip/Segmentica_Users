import type { OrderSupplyMode } from "@/lib/orderModes";

export interface OrderWorkflowPositionSummary {
    товар_id: number;
    товар_название: string;
    товар_артикул?: string;
    способ_обеспечения: OrderSupplyMode;
    необходимое_количество: number;
    склад_количество: number;
    активная_недостача: number;
    закуплено_количество: number;
    осталось_закупить: number;
    покрыто_со_склада: number;
    собранное_количество: number;
    отгруженное_количество: number;
    доставленное_количество: number;
    осталось_собрать: number;
    осталось_отгрузить: number;
}
