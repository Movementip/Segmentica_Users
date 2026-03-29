type DbLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

export const recalculateStoredOrderTotal = async (db: DbLike, orderId: number): Promise<void> => {
    await db.query(
        `
            UPDATE public."Заявки" orders
            SET "общая_сумма" = COALESCE(calc.total_amount, 0)
            FROM (
                SELECT
                    seed."заявка_id",
                    (
                        COALESCE(items.items_total, 0)
                        + COALESCE(purchase_logistics.purchase_delivery_total, 0)
                        + COALESCE(shipment_logistics.shipment_delivery_total, 0)
                    )::numeric AS total_amount
                FROM (SELECT $1::int AS "заявка_id") seed
                LEFT JOIN (
                    SELECT
                        positions."заявка_id",
                        SUM(
                            COALESCE(positions."количество", 0)
                            * COALESCE(positions."цена", 0)
                            * (1 + COALESCE(vat."ставка", 0) / 100.0)
                        )::numeric AS items_total
                    FROM public."Позиции_заявки" positions
                    LEFT JOIN public."Ставки_НДС" vat
                        ON vat.id = positions."ндс_id"
                    WHERE positions."заявка_id" = $1
                    GROUP BY positions."заявка_id"
                ) items
                    ON items."заявка_id" = seed."заявка_id"
                LEFT JOIN (
                    SELECT
                        purchases."заявка_id",
                        SUM(
                            CASE
                                WHEN COALESCE(purchases."использовать_доставку", false)
                                  AND COALESCE(purchases."статус", 'заказано') <> 'отменено'
                                  THEN COALESCE(purchases."стоимость_доставки", 0)
                                ELSE 0
                            END
                        )::numeric AS purchase_delivery_total
                    FROM public."Закупки" purchases
                    WHERE purchases."заявка_id" = $1
                    GROUP BY purchases."заявка_id"
                ) purchase_logistics
                    ON purchase_logistics."заявка_id" = seed."заявка_id"
                LEFT JOIN (
                    SELECT
                        shipments."заявка_id",
                        SUM(
                            CASE
                                WHEN COALESCE(shipments."использовать_доставку", true)
                                  AND COALESCE(shipments."статус", 'в пути') <> 'отменено'
                                  THEN COALESCE(shipments."стоимость_доставки", 0)
                                ELSE 0
                            END
                        )::numeric AS shipment_delivery_total
                    FROM public."Отгрузки" shipments
                    WHERE shipments."заявка_id" = $1
                    GROUP BY shipments."заявка_id"
                ) shipment_logistics
                    ON shipment_logistics."заявка_id" = seed."заявка_id"
            ) calc
            WHERE orders.id = $1
        `,
        [orderId]
    );
};
