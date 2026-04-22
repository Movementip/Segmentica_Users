type DbClientLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

const toMoney = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
};

type FinanceRecordType = 'расход' | 'поступление';
type FinanceRecordSource = 'закупка' | 'отгрузка';

type FinanceRecordInput = {
    date?: unknown;
    type: FinanceRecordType;
    description: string;
    amount: number;
    source: FinanceRecordSource;
    purchaseId?: number | null;
    shipmentId?: number | null;
    productId?: number | null;
    accountingAccount?: unknown;
    expenseAccount?: unknown;
    nomenclatureType?: unknown;
};

const toOptionalText = (value: unknown): string | null => {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized ? normalized : null;
};

const insertFinanceRecord = async (db: DbClientLike, record: FinanceRecordInput): Promise<void> => {
    await db.query(
        `
            INSERT INTO "Финансы_компании" (
                "дата",
                "тип",
                "описание",
                "сумма",
                "закупка_id",
                "отгрузка_id",
                "товар_id",
                "счет_учета",
                "счет_затрат",
                "тип_номенклатуры",
                "источник"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
            record.date ?? null,
            record.type,
            record.description,
            record.amount,
            record.purchaseId ?? null,
            record.shipmentId ?? null,
            record.productId ?? null,
            toOptionalText(record.accountingAccount),
            toOptionalText(record.expenseAccount),
            toOptionalText(record.nomenclatureType),
            record.source,
        ]
    );
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
                purchases."дата_поступления",
                COALESCE(purchases."использовать_доставку", false) AS use_delivery,
                COALESCE(purchases."стоимость_доставки", 0)::numeric AS delivery_cost,
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
    const purchaseDate = purchase.дата_поступления ?? null;
    const positionsResult = await db.query(
        `
            SELECT
                pz."товар_id" AS product_id,
                products."название" AS product_name,
                products."счет_учета" AS accounting_account,
                products."счет_затрат" AS expense_account,
                products."тип_номенклатуры" AS nomenclature_type,
                COALESCE(pz."количество", 0)::numeric AS quantity,
                COALESCE(pz."цена", 0)::numeric AS price,
                COALESCE(vat."ставка", 0)::numeric AS vat_rate
            FROM "Позиции_закупки" pz
            JOIN "Товары" products
                ON products.id = pz."товар_id"
            LEFT JOIN "Ставки_НДС" vat
                ON vat.id = pz."ндс_id"
            WHERE pz."закупка_id" = $1
            ORDER BY pz.id ASC
        `,
        [purchaseId]
    );

    let insertedLines = 0;

    for (const row of positionsResult.rows) {
        const lineAmount = toMoney(
            Number(row.quantity || 0) * Number(row.price || 0) * (1 + Number(row.vat_rate || 0) / 100)
        );

        if (lineAmount <= 0) {
            continue;
        }

        await insertFinanceRecord(db, {
            date: purchaseDate,
            type: 'расход',
            description: `Закупка #${purchaseId}: ${String(row.product_name || `Товар #${row.product_id}`)}${supplierSuffix}`,
            amount: lineAmount,
            source: 'закупка',
            purchaseId,
            productId: Number(row.product_id) || null,
            accountingAccount: row.accounting_account,
            expenseAccount: row.expense_account,
            nomenclatureType: row.nomenclature_type,
        });
        insertedLines += 1;
    }

    const deliveryCost = purchase.use_delivery ? toMoney(purchase.delivery_cost) : 0;

    if (deliveryCost > 0) {
        await insertFinanceRecord(db, {
            date: purchaseDate,
            type: 'расход',
            description: `Доставка закупки #${purchaseId}${supplierSuffix}`,
            amount: deliveryCost,
            source: 'закупка',
            purchaseId,
        });
        insertedLines += 1;
    }

    if (insertedLines === 0) {
        await insertFinanceRecord(db, {
            date: purchaseDate,
            type: 'расход',
            description: `Оплата закупки #${purchaseId}${supplierSuffix}`,
            amount,
            source: 'закупка',
            purchaseId,
        });
    }
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
                shipments."дата_отгрузки",
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

    const shipmentDate = shipment.дата_отгрузки ?? null;
    const positionsResult = await db.query(
        `
            SELECT
                positions.product_id,
                products."название" AS product_name,
                products."счет_учета" AS accounting_account,
                products."счет_затрат" AS expense_account,
                products."тип_номенклатуры" AS nomenclature_type,
                COALESCE(positions.quantity, 0)::numeric AS quantity,
                COALESCE(positions.price, 0)::numeric AS price,
                COALESCE(vat."ставка", 0)::numeric AS vat_rate
            FROM public.shipment_positions positions
            JOIN "Товары" products
                ON products.id = positions.product_id
            LEFT JOIN "Ставки_НДС" vat
                ON vat.id = positions.vat_id
            WHERE positions.shipment_id = $1
            ORDER BY positions.id ASC
        `,
        [shipmentId]
    );

    let insertedLines = 0;

    for (const row of positionsResult.rows) {
        const lineAmount = toMoney(
            Number(row.quantity || 0) * Number(row.price || 0) * (1 + Number(row.vat_rate || 0) / 100)
        );

        if (lineAmount <= 0) {
            continue;
        }

        await insertFinanceRecord(db, {
            date: shipmentDate,
            type: 'поступление',
            description: `Самостоятельная отгрузка #${shipmentId}: ${String(row.product_name || `Товар #${row.product_id}`)}`,
            amount: lineAmount,
            source: 'отгрузка',
            shipmentId,
            productId: Number(row.product_id) || null,
            accountingAccount: row.accounting_account,
            expenseAccount: row.expense_account,
            nomenclatureType: row.nomenclature_type,
        });
        insertedLines += 1;
    }

    if (deliveryCost > 0) {
        await insertFinanceRecord(db, {
            date: shipmentDate,
            type: 'поступление',
            description: `Доставка по самостоятельной отгрузке #${shipmentId}`,
            amount: deliveryCost,
            source: 'отгрузка',
            shipmentId,
        });
        insertedLines += 1;
    }

    if (insertedLines === 0) {
        await insertFinanceRecord(db, {
            date: shipmentDate,
            type: 'поступление',
            description: `Самостоятельная отгрузка #${shipmentId}`,
            amount,
            source: 'отгрузка',
            shipmentId,
        });
    }
};
