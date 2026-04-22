type DbClientLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

const getAppSettingBoolean = (raw: any, fallback = false): boolean => {
    if (!raw || typeof raw !== 'object') return fallback;
    const candidate = raw.enabled ?? raw.value ?? fallback;
    if (candidate === true || candidate === false) return candidate;
    return String(candidate).trim().toLowerCase() === 'true';
};

export const recalculateShipmentDeliveryCostIfNeeded = async (
    db: DbClientLike,
    shipmentId: number,
    options?: { skipIfCostAlreadySet?: boolean }
): Promise<void> => {
    const shipmentResult = await db.query(
        `
            SELECT
                id,
                "использовать_доставку",
                "транспорт_id",
                "стоимость_доставки"
            FROM "Отгрузки"
            WHERE id = $1
            LIMIT 1
        `,
        [shipmentId]
    );
    const shipment = shipmentResult.rows[0];
    if (!shipment) return;

    if (!shipment.использовать_доставку || !shipment.транспорт_id) {
        return;
    }

    if (options?.skipIfCostAlreadySet && shipment.стоимость_доставки != null) {
        return;
    }

    const settingsResult = await db.query(
        `
            SELECT value
            FROM public.app_settings
            WHERE key = 'auto_calculate_shipment_delivery_cost'
            LIMIT 1
        `
    );
    const autoCalculateEnabled = getAppSettingBoolean(settingsResult.rows[0]?.value, false);
    if (!autoCalculateEnabled) {
        return;
    }

    const [transportResult, positionsResult] = await Promise.all([
        db.query(
            `
                SELECT COALESCE("тариф", 0)::numeric AS rate
                FROM "Транспортные_компании"
                WHERE id = $1
                LIMIT 1
            `,
            [shipment.транспорт_id]
        ),
        db.query(
            `
                SELECT COALESCE(SUM(quantity), 0)::numeric AS total_quantity
                FROM public.shipment_positions
                WHERE shipment_id = $1
            `,
            [shipmentId]
        ),
    ]);

    const deliveryRate = Number(transportResult.rows[0]?.rate) || 0;
    const totalQuantity = Number(positionsResult.rows[0]?.total_quantity) || 0;
    const nextCost = deliveryRate * totalQuantity;

    await db.query(
        'UPDATE "Отгрузки" SET "стоимость_доставки" = $1 WHERE id = $2',
        [nextCost, shipmentId]
    );
};
