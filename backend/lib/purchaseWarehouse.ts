type DbClientLike = {
    query: (text: string, params?: any[]) => Promise<any>;
};

const toPositiveNumber = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const normalizeMovementEffect = (operationType: unknown, quantity: unknown): number => {
    const normalizedQty = toPositiveNumber(quantity);
    const normalizedType = String(operationType || '').trim().toLowerCase();
    return normalizedType === 'расход' ? -normalizedQty : normalizedQty;
};

const loadPurchasePositionMap = async (db: DbClientLike, purchaseId: number): Promise<Map<number, number>> => {
    const result = await db.query(
        `
            SELECT
                "товар_id",
                COALESCE("количество", 0)::numeric AS quantity
            FROM "Позиции_закупки"
            WHERE "закупка_id" = $1
        `,
        [purchaseId]
    );

    const quantities = new Map<number, number>();
    for (const row of result.rows) {
        const productId = Number(row.товар_id);
        const quantity = toPositiveNumber(row.quantity);
        if (!productId || quantity <= 0) continue;
        quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    return quantities;
};

const loadAppliedMovementMap = async (db: DbClientLike, purchaseId: number): Promise<Map<number, number>> => {
    const result = await db.query(
        `
            SELECT
                "товар_id",
                "тип_операции",
                COALESCE("количество", 0)::numeric AS quantity
            FROM "Движения_склада"
            WHERE "закупка_id" = $1
        `,
        [purchaseId]
    );

    const applied = new Map<number, number>();
    for (const row of result.rows) {
        const productId = Number(row.товар_id);
        const effect = normalizeMovementEffect(row.тип_операции, row.quantity);
        if (!productId || effect === 0) continue;
        applied.set(productId, (applied.get(productId) || 0) + effect);
    }

    return applied;
};

const applyStockDelta = async (db: DbClientLike, productId: number, delta: number, purchaseId: number) => {
    if (!productId || delta === 0) return;

    if (delta > 0) {
        await db.query(
            `
                INSERT INTO "Склад" ("товар_id", "количество", "дата_последнего_поступления")
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT ("товар_id")
                DO UPDATE SET
                    "количество" = "Склад"."количество" + EXCLUDED."количество",
                    "дата_последнего_поступления" = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
            `,
            [productId, delta]
        );
        return;
    }

    const quantityToRemove = Math.abs(delta);
    const stockResult = await db.query(
        'SELECT COALESCE("количество", 0)::numeric AS quantity FROM "Склад" WHERE "товар_id" = $1 LIMIT 1',
        [productId]
    );
    const currentQuantity = Number(stockResult.rows[0]?.quantity) || 0;

    if (currentQuantity < quantityToRemove) {
        throw new Error(
            `Нельзя пересчитать склад по закупке #${purchaseId}: для товара ${productId} на складе только ${currentQuantity}, а снять нужно ${quantityToRemove}`
        );
    }

    await db.query(
        `
            UPDATE "Склад"
            SET "количество" = "количество" - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE "товар_id" = $2
        `,
        [quantityToRemove, productId]
    );
};

export const syncPurchaseWarehouseState = async (
    db: DbClientLike,
    purchaseId: number,
    shouldApplyReceipt: boolean
): Promise<void> => {
    const purchaseMetaResult = await db.query(
        `
            SELECT "заявка_id"
            FROM "Закупки"
            WHERE id = $1
            LIMIT 1
        `,
        [purchaseId]
    );
    const linkedOrderId = purchaseMetaResult.rows[0]?.заявка_id == null ? null : Number(purchaseMetaResult.rows[0].заявка_id);
    const movementComment = linkedOrderId == null ? `Самостоятельная закупка #${purchaseId}` : null;

    const desired = shouldApplyReceipt ? await loadPurchasePositionMap(db, purchaseId) : new Map<number, number>();
    const applied = await loadAppliedMovementMap(db, purchaseId);
    const productIds = new Set<number>([
        ...Array.from(desired.keys()),
        ...Array.from(applied.keys()),
    ]);

    for (const productId of Array.from(productIds)) {
        const desiredQuantity = desired.get(productId) || 0;
        const appliedQuantity = applied.get(productId) || 0;
        const delta = desiredQuantity - appliedQuantity;
        if (delta !== 0) {
            await applyStockDelta(db, productId, delta, purchaseId);
        }
    }

    await db.query('DELETE FROM "Движения_склада" WHERE "закупка_id" = $1', [purchaseId]);

    if (!shouldApplyReceipt) return;

    for (const [productId, quantity] of Array.from(desired.entries())) {
        if (quantity <= 0) continue;
        await db.query(
            `
                INSERT INTO "Движения_склада" (
                    "товар_id", "тип_операции", "количество", "дата_операции", "закупка_id", "комментарий"
                ) VALUES ($1, 'приход', $2, CURRENT_TIMESTAMP, $3, $4)
            `,
            [productId, quantity, purchaseId, movementComment]
        );
    }
};
