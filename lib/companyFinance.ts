type DbClientLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

const toMoney = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
};

export const syncPurchaseFinanceRecord = async (
    db: DbClientLike,
    purchaseId: number
): Promise<void> => {
    const purchaseResult = await db.query(
        `
            SELECT
                purchases.id,
                purchases."статус",
                purchases."общая_сумма",
                suppliers."название" AS supplier_name
            FROM "Закупки" purchases
            LEFT JOIN "Поставщики" suppliers
                ON suppliers.id = purchases."поставщик_id"
            WHERE purchases.id = $1
            LIMIT 1
        `,
        [purchaseId]
    );

    await db.query('DELETE FROM "Финансы_компании" WHERE "закупка_id" = $1', [purchaseId]);

    if (purchaseResult.rows.length === 0) {
        return;
    }

    const purchase = purchaseResult.rows[0];
    const status = String(purchase.статус || '').trim().toLowerCase();
    const amount = toMoney(purchase.общая_сумма);

    if (status !== 'получено' || amount <= 0) {
        return;
    }

    const supplierSuffix = purchase.supplier_name ? ` (${purchase.supplier_name})` : '';
    await db.query(
        `
            INSERT INTO "Финансы_компании" ("тип", "описание", "сумма", "закупка_id")
            VALUES ($1, $2, $3, $4)
        `,
        ['расход', `Оплата закупки #${purchaseId}${supplierSuffix}`, amount, purchaseId]
    );
};

export const syncStandaloneShipmentFinanceRecord = async (
    db: DbClientLike,
    shipmentId: number
): Promise<void> => {
    const shipmentResult = await db.query(
        `
            SELECT
                shipments.id,
                shipments."заявка_id",
                COALESCE(shipments."статус", 'в пути') AS status,
                COALESCE(shipments."использовать_доставку", true) AS use_delivery,
                COALESCE(shipments."стоимость_доставки", 0)::numeric AS delivery_cost,
                COALESCE(
                    SUM(
                        COALESCE(positions.quantity, 0)
                        * COALESCE(positions.price, 0)
                        * (1 + COALESCE(vat."ставка", 0) / 100.0)
                    ),
                    0
                )::numeric AS items_total
            FROM "Отгрузки" shipments
            LEFT JOIN public.shipment_positions positions
                ON positions.shipment_id = shipments.id
            LEFT JOIN "Ставки_НДС" vat
                ON vat.id = positions.vat_id
            WHERE shipments.id = $1
            GROUP BY shipments.id
            LIMIT 1
        `,
        [shipmentId]
    );

    await db.query(
        'DELETE FROM "Финансы_компании" WHERE "отгрузка_id" = $1 AND "заявка_id" IS NULL',
        [shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
        return;
    }

    const shipment = shipmentResult.rows[0];
    const status = String(shipment.status || '').trim().toLowerCase();
    const orderId = shipment.заявка_id == null ? null : Number(shipment.заявка_id);

    if (orderId != null || status === 'отменено') {
        return;
    }

    const itemsTotal = toMoney(shipment.items_total);
    const deliveryCost = shipment.use_delivery ? toMoney(shipment.delivery_cost) : 0;
    const amount = toMoney(itemsTotal + deliveryCost);

    if (amount <= 0) {
        return;
    }

    await db.query(
        `
            INSERT INTO "Финансы_компании" ("тип", "описание", "сумма", "отгрузка_id")
            VALUES ($1, $2, $3, $4)
        `,
        ['поступление', `Самостоятельная отгрузка #${shipmentId}`, amount, shipmentId]
    );
};
