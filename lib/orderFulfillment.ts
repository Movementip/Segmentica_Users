import type { QueryResult } from 'pg';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption, normalizeVatRateId } from './vat';
import { normalizeOrderExecutionMode } from './orderModes';

type QueryFn = (text: string, params?: any[]) => Promise<QueryResult<any>>;

type DbLike = QueryFn | {
    query: QueryFn;
};

const runQuery = (db: DbLike, text: string, params?: any[]) => (
    typeof db === 'function' ? db(text, params) : db.query(text, params)
);

const normalizeStatus = (value?: string | null) => (value || '').trim().toLowerCase();

const calculateOrderTotal = (positions: Array<{ количество: number; цена: number; ндс_id?: number }>) => (
    positions.reduce((sum, item) => {
        const vatRate = getVatRateOption(item?.ндс_id ?? DEFAULT_VAT_RATE_ID).rate;
        return sum + calculateVatAmountsFromLine(Number(item?.количество), Number(item?.цена), vatRate).total;
    }, 0)
);

export async function syncOrderPositionsFromLinkedPurchases(db: DbLike, orderId: number) {
    const aggregatedPurchasePositions = await runQuery(
        db,
        `
            SELECT
                purchase_positions."товар_id",
                SUM(COALESCE(purchase_positions."количество", 0))::integer AS quantity,
                MAX(COALESCE(purchase_positions."ндс_id", $2))::integer AS vat_id,
                MAX(COALESCE(products."цена_продажи", products."цена_закупки", purchase_positions."цена", 0))::numeric AS sale_price
            FROM "Закупки" purchases
            INNER JOIN "Позиции_закупки" purchase_positions
                ON purchase_positions."закупка_id" = purchases.id
            LEFT JOIN "Товары" products
                ON products.id = purchase_positions."товар_id"
            WHERE purchases."заявка_id" = $1
              AND COALESCE(purchases."статус", 'заказано') != 'отменено'
            GROUP BY purchase_positions."товар_id"
        `,
        [orderId, DEFAULT_VAT_RATE_ID]
    );

    if (aggregatedPurchasePositions.rows.length === 0) {
        return;
    }

    const existingPositionsResult = await runQuery(
        db,
        `
            SELECT
                id,
                "товар_id",
                COALESCE("количество", 0)::integer AS quantity,
                COALESCE("цена", 0)::numeric AS price,
                COALESCE("ндс_id", $2)::integer AS vat_id
            FROM "Позиции_заявки"
            WHERE "заявка_id" = $1
        `,
        [orderId, DEFAULT_VAT_RATE_ID]
    );

    const existingByProductId = new Map<number, any>();
    for (const row of existingPositionsResult.rows) {
        existingByProductId.set(Number(row.товар_id), row);
    }

    for (const row of aggregatedPurchasePositions.rows) {
        const productId = Number(row.товар_id);
        const purchaseQuantity = Number(row.quantity) || 0;
        const salePrice = Number(row.sale_price) || 0;
        const vatId = normalizeVatRateId(row.vat_id);
        const existing = existingByProductId.get(productId);

        if (!existing) {
            await runQuery(
                db,
                `
                    INSERT INTO "Позиции_заявки" ("заявка_id", "товар_id", "количество", "цена", "ндс_id")
                    VALUES ($1, $2, $3, $4, $5)
                `,
                [orderId, productId, purchaseQuantity, salePrice, vatId]
            );
            continue;
        }

        const existingPrice = Number(existing.price) || 0;
        const existingVatId = existing.vat_id == null ? null : Number(existing.vat_id);
        if (existingPrice <= 0 || existingVatId == null) {
            await runQuery(
                db,
                `
                    UPDATE "Позиции_заявки"
                    SET "цена" = CASE WHEN COALESCE("цена", 0) <= 0 THEN $1 ELSE "цена" END,
                        "ндс_id" = COALESCE("ндс_id", $2)
                    WHERE id = $3
                `,
                [salePrice, vatId, existing.id]
            );
        }
    }

    const finalPositionsResult = await runQuery(
        db,
        `
            SELECT
                COALESCE("количество", 0)::numeric AS quantity,
                COALESCE("цена", 0)::numeric AS price,
                COALESCE("ндс_id", $2)::integer AS vat_id
            FROM "Позиции_заявки"
            WHERE "заявка_id" = $1
        `,
        [orderId, DEFAULT_VAT_RATE_ID]
    );

    const finalPositions = finalPositionsResult.rows.map((row) => ({
        количество: Number(row.quantity) || 0,
        цена: Number(row.price) || 0,
        ндс_id: Number(row.vat_id) || DEFAULT_VAT_RATE_ID,
    }));

    await runQuery(
        db,
        `
            UPDATE "Заявки"
            SET "общая_сумма" = $1
            WHERE id = $2
        `,
        [calculateOrderTotal(finalPositions), orderId]
    );
}

export async function getNextAssemblyBranchMeta(db: DbLike, orderId: number) {
    const result = await runQuery(
        db,
        `
            SELECT
                COALESCE(MAX(branch_no), 0)::integer AS max_branch_no,
                COUNT(*)::integer AS batch_count
            FROM public.order_assembly_batches
            WHERE order_id = $1
        `,
        [orderId]
    );

    const maxBranchNo = Number(result.rows[0]?.max_branch_no) || 0;
    const batchCount = Number(result.rows[0]?.batch_count) || 0;

    return {
        branchNo: maxBranchNo + 1,
        batchType: batchCount > 0 ? 'досборка' : 'сборка',
    };
}

export async function getNextShipmentBranchMeta(db: DbLike, orderId: number) {
    const result = await runQuery(
        db,
        `
            SELECT
                COALESCE(MAX(branch_no), 0)::integer AS max_branch_no,
                COUNT(*)::integer AS shipment_count
            FROM "Отгрузки"
            WHERE "заявка_id" = $1
        `,
        [orderId]
    );

    const maxBranchNo = Number(result.rows[0]?.max_branch_no) || 0;
    const shipmentCount = Number(result.rows[0]?.shipment_count) || 0;

    return {
        branchNo: maxBranchNo + 1,
        shipmentKind: shipmentCount > 0 ? 'доотгрузка' : 'основная',
    };
}

export async function getRemainingShipmentDraft(db: DbLike, orderId: number) {
    const orderResult = await runQuery(
        db,
        `
            SELECT "режим_исполнения"
            FROM "Заявки"
            WHERE id = $1
            LIMIT 1
        `,
        [orderId]
    );
    const executionMode = normalizeOrderExecutionMode(orderResult.rows[0]?.режим_исполнения);

    const result = await runQuery(
        db,
        `
            SELECT
                order_positions."товар_id" AS product_id,
                COALESCE(products."название", CONCAT('Товар #', order_positions."товар_id")) AS product_name,
                COALESCE(products."артикул", '') AS product_article,
                COALESCE(products."единица_измерения", 'шт') AS product_unit,
                COALESCE(order_positions."цена", 0)::numeric AS price,
                COALESCE(order_positions."ндс_id", $2)::integer AS vat_id,
                COALESCE(order_positions."количество", 0)::numeric AS required_qty,
                COALESCE(assembled.assembled_qty, 0)::numeric AS assembled_qty,
                COALESCE(shipped.shipped_qty, 0)::numeric AS shipped_qty
            FROM "Позиции_заявки" order_positions
            LEFT JOIN "Товары" products
                ON products.id = order_positions."товар_id"
            LEFT JOIN (
                SELECT
                    positions.product_id,
                    SUM(positions.quantity)::numeric AS assembled_qty
                FROM public.order_assembly_batches batches
                INNER JOIN public.order_assembly_batch_positions positions
                    ON positions.batch_id = batches.id
                WHERE batches.order_id = $1
                GROUP BY positions.product_id
            ) assembled
                ON assembled.product_id = order_positions."товар_id"
            LEFT JOIN (
                SELECT
                    shipment_positions.product_id,
                    SUM(shipment_positions.quantity)::numeric AS shipped_qty
                FROM "Отгрузки" shipments
                INNER JOIN public.shipment_positions shipment_positions
                    ON shipment_positions.shipment_id = shipments.id
                WHERE shipments."заявка_id" = $1
                  AND COALESCE(shipments."статус", 'в пути') != 'отменено'
                GROUP BY shipment_positions.product_id
            ) shipped
                ON shipped.product_id = order_positions."товар_id"
            WHERE order_positions."заявка_id" = $1
            ORDER BY order_positions.id
        `,
        [orderId, DEFAULT_VAT_RATE_ID]
    );

    return result.rows
        .map((row) => {
            const requiredQty = Number(row.required_qty) || 0;
            const assembledQty = Number(row.assembled_qty) || 0;
            const shippedQty = Number(row.shipped_qty) || 0;
            const availableToShip = Math.max(0, Math.min(requiredQty, assembledQty) - shippedQty);

            return {
                товар_id: Number(row.product_id),
                товар_название: row.product_name || `Товар #${row.product_id}`,
                товар_артикул: row.product_article || '',
                товар_единица_измерения: row.product_unit || 'шт',
                количество: availableToShip,
                цена: Number(row.price) || 0,
                ндс_id: normalizeVatRateId(row.vat_id),
            };
        })
        .filter((row) => row.товар_id > 0 && row.количество > 0);
}

export async function getShipmentPositions(db: DbLike, shipmentId: number) {
    const result = await runQuery(
        db,
        `
            SELECT
                shipment_positions.id,
                shipment_positions.product_id AS "товар_id",
                shipment_positions.quantity AS "количество",
                shipment_positions.price AS "цена",
                shipment_positions.vat_id AS "ндс_id",
                products."название" AS товар_название,
                products."артикул" AS товар_артикул,
                products."категория" AS товар_категория,
                products."единица_измерения" AS товар_единица_измерения,
                vat_rates."название" AS ндс_название,
                vat_rates."ставка" AS ндс_ставка
            FROM public.shipment_positions shipment_positions
            LEFT JOIN "Товары" products
                ON products.id = shipment_positions.product_id
            LEFT JOIN "Ставки_НДС" vat_rates
                ON vat_rates.id = shipment_positions.vat_id
            WHERE shipment_positions.shipment_id = $1
            ORDER BY shipment_positions.id
        `,
        [shipmentId]
    );

    return result.rows.map((row) => {
        const price = Number(row.цена) || 0;
        const quantity = Number(row.количество) || 0;
        const vatRate = Number(row.ндс_ставка) || getVatRateOption(row.ндс_id).rate;
        const breakdown = calculateVatAmountsFromLine(quantity, price, vatRate);

        return {
            id: Number(row.id),
            товар_id: Number(row.товар_id),
            количество: quantity,
            цена: price,
            сумма: breakdown.total,
            ндс_id: Number(row.ндс_id) || DEFAULT_VAT_RATE_ID,
            ндс_название: row.ндс_название || getVatRateOption(row.ндс_id).label,
            ндс_ставка: vatRate,
            сумма_без_ндс: breakdown.net,
            сумма_ндс: breakdown.tax,
            сумма_всего: breakdown.total,
            товар_название: row.товар_название || `Товар #${row.товар_id}`,
            товар_артикул: row.товар_артикул || '',
            товар_категория: row.товар_категория || '',
            товар_единица_измерения: row.товар_единица_измерения || 'шт',
        };
    });
}

export async function reconcileOrderExecutionsForPositionUpdate(
    db: DbLike,
    orderId: number,
    nextPositions: Array<{ товар_id: number; количество: number }>
) {
    const orderResult = await runQuery(
        db,
        `
            SELECT "режим_исполнения"
            FROM "Заявки"
            WHERE id = $1
            LIMIT 1
        `,
        [orderId]
    );
    const executionMode = normalizeOrderExecutionMode(orderResult.rows[0]?.режим_исполнения);

    const desiredQtyByProduct = new Map<number, number>();
    for (const position of nextPositions) {
        desiredQtyByProduct.set(Number(position.товар_id), Number(position.количество) || 0);
    }

    const executionResult = await runQuery(
        db,
        `
            SELECT
                order_positions."товар_id" AS product_id,
                COALESCE(products."название", CONCAT('Товар #', order_positions."товар_id")) AS product_name,
                COALESCE(assembled.assembled_qty, 0)::integer AS assembled_qty,
                COALESCE(shipped.shipped_qty, 0)::integer AS shipped_qty,
                COALESCE(purchases.purchased_qty, 0)::integer AS purchased_qty
            FROM "Позиции_заявки" order_positions
            LEFT JOIN "Товары" products
                ON products.id = order_positions."товар_id"
            LEFT JOIN (
                SELECT
                    positions.product_id,
                    SUM(positions.quantity)::integer AS assembled_qty
                FROM public.order_assembly_batches batches
                INNER JOIN public.order_assembly_batch_positions positions
                    ON positions.batch_id = batches.id
                WHERE batches.order_id = $1
                GROUP BY positions.product_id
            ) assembled
                ON assembled.product_id = order_positions."товар_id"
            LEFT JOIN (
                SELECT
                    shipment_positions.product_id,
                    SUM(shipment_positions.quantity)::integer AS shipped_qty
                FROM "Отгрузки" shipments
                INNER JOIN public.shipment_positions shipment_positions
                    ON shipment_positions.shipment_id = shipments.id
                WHERE shipments."заявка_id" = $1
                  AND COALESCE(shipments."статус", 'в пути') != 'отменено'
                GROUP BY shipment_positions.product_id
            ) shipped
                ON shipped.product_id = order_positions."товар_id"
            LEFT JOIN (
                SELECT
                    purchase_positions."товар_id" AS product_id,
                    SUM(purchase_positions."количество")::integer AS purchased_qty
                FROM "Закупки" purchases
                INNER JOIN "Позиции_закупки" purchase_positions
                    ON purchase_positions."закупка_id" = purchases.id
                WHERE purchases."заявка_id" = $1
                  AND COALESCE(purchases."статус", 'заказано') != 'отменено'
                GROUP BY purchase_positions."товар_id"
            ) purchases
                ON purchases.product_id = order_positions."товар_id"
            WHERE order_positions."заявка_id" = $1
        `,
        [orderId]
    );

    for (const row of executionResult.rows) {
        const productId = Number(row.product_id);
        const productName = String(row.product_name || `Товар #${productId}`);
        const desiredQty = desiredQtyByProduct.get(productId) ?? 0;
        const assembledQty = Number(row.assembled_qty) || 0;
        const shippedQty = Number(row.shipped_qty) || 0;
        const purchasedQty = Number(row.purchased_qty) || 0;

        if (shippedQty > desiredQty) {
            throw new Error(`Нельзя уменьшить или удалить позицию «${productName}»: уже отгружено ${shippedQty}`);
        }

        if (purchasedQty > desiredQty) {
            throw new Error(`Нельзя уменьшить или удалить позицию «${productName}»: по ней уже есть связанная закупка на ${purchasedQty}. Сначала скорректируйте закупку.`);
        }

        const rollbackQty = Math.max(0, assembledQty - desiredQty);
        if (rollbackQty <= 0) {
            continue;
        }

        const rollbackableQty = Math.max(0, assembledQty - shippedQty);
        if (rollbackQty > rollbackableQty) {
            throw new Error(`Нельзя уменьшить позицию «${productName}»: часть товара уже закреплена в отгрузке`);
        }

        const batchPositionsResult = await runQuery(
            db,
            `
                SELECT
                    positions.id,
                    positions.batch_id,
                    COALESCE(positions.quantity, 0)::integer AS quantity,
                    COALESCE(batches.branch_no, 1)::integer AS branch_no,
                    COALESCE(batches.batch_type, 'сборка') AS batch_type
                FROM public.order_assembly_batch_positions positions
                INNER JOIN public.order_assembly_batches batches
                    ON batches.id = positions.batch_id
                WHERE batches.order_id = $1
                  AND positions.product_id = $2
                ORDER BY COALESCE(batches.branch_no, 1) DESC, positions.id DESC
            `,
            [orderId, productId]
        );

        let remainingRollbackQty = rollbackQty;
        for (const batchPosition of batchPositionsResult.rows) {
            if (remainingRollbackQty <= 0) {
                break;
            }

            const currentQty = Number(batchPosition.quantity) || 0;
            if (currentQty <= 0) {
                continue;
            }

            const qtyToRollback = Math.min(currentQty, remainingRollbackQty);
            const nextQty = currentQty - qtyToRollback;

            if (nextQty > 0) {
                await runQuery(
                    db,
                    'UPDATE public.order_assembly_batch_positions SET quantity = $1 WHERE id = $2',
                    [nextQty, batchPosition.id]
                );
            } else {
                await runQuery(
                    db,
                    'DELETE FROM public.order_assembly_batch_positions WHERE id = $1',
                    [batchPosition.id]
                );
            }

            remainingRollbackQty -= qtyToRollback;
        }

        if (remainingRollbackQty > 0) {
            throw new Error(`Не удалось откатить сборку для позиции «${productName}»`);
        }

        if (executionMode !== 'direct') {
            await runQuery(
                db,
                `
                    INSERT INTO "Склад" ("товар_id", "количество")
                    VALUES ($1, $2)
                    ON CONFLICT ("товар_id")
                    DO UPDATE SET
                        "количество" = "Склад"."количество" + EXCLUDED."количество",
                        updated_at = CURRENT_TIMESTAMP
                `,
                [productId, rollbackQty]
            );

            await runQuery(
                db,
                `
                    INSERT INTO "Движения_склада" (
                        "товар_id",
                        "тип_операции",
                        "количество",
                        "дата_операции",
                        "заявка_id",
                        "комментарий"
                    ) VALUES ($1, 'приход', $2, CURRENT_TIMESTAMP, $3, $4)
                `,
                [productId, rollbackQty, orderId, `Откат сборки по заявке #${orderId} после изменения состава заявки`]
            );
        }
    }

    await runQuery(
        db,
        `
            DELETE FROM public.order_assembly_batches batches
            WHERE batches.order_id = $1
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.order_assembly_batch_positions positions
                  WHERE positions.batch_id = batches.id
              )
        `,
        [orderId]
    );
}

export async function rollbackOrderFulfillment(
    db: DbLike,
    orderId: number,
    options?: {
        reason?: string;
        detachOrderReferences?: boolean;
        closeMissingProducts?: boolean;
    }
) {
    const reason = options?.reason?.trim() || `Отмена заявки #${orderId}`;
    const detachOrderReferences = Boolean(options?.detachOrderReferences);
    const closeMissingProducts = options?.closeMissingProducts !== false;
    const orderResult = await runQuery(
        db,
        `
            SELECT "режим_исполнения"
            FROM "Заявки"
            WHERE id = $1
            LIMIT 1
        `,
        [orderId]
    );
    const executionMode = normalizeOrderExecutionMode(orderResult.rows[0]?.режим_исполнения);

    const assembledResult = await runQuery(
        db,
        `
            SELECT
                positions.product_id,
                COALESCE(products."название", CONCAT('Товар #', positions.product_id)) AS product_name,
                SUM(COALESCE(positions.quantity, 0))::integer AS assembled_qty
            FROM public.order_assembly_batches batches
            INNER JOIN public.order_assembly_batch_positions positions
                ON positions.batch_id = batches.id
            LEFT JOIN "Товары" products
                ON products.id = positions.product_id
            WHERE batches.order_id = $1
            GROUP BY positions.product_id, products."название"
            ORDER BY positions.product_id
        `,
        [orderId]
    );

    await runQuery(
        db,
        'DELETE FROM public.shipment_positions WHERE shipment_id IN (SELECT id FROM "Отгрузки" WHERE "заявка_id" = $1)',
        [orderId]
    );

    await runQuery(
        db,
        'DELETE FROM "Отгрузки" WHERE "заявка_id" = $1',
        [orderId]
    );

    for (const row of assembledResult.rows) {
        const productId = Number(row.product_id);
        const assembledQty = Number(row.assembled_qty) || 0;
        const productName = String(row.product_name || `Товар #${productId}`);

        if (productId <= 0 || assembledQty <= 0) {
            continue;
        }

        if (executionMode !== 'direct') {
            await runQuery(
                db,
                `
                    INSERT INTO "Склад" ("товар_id", "количество")
                    VALUES ($1, $2)
                    ON CONFLICT ("товар_id")
                    DO UPDATE SET
                        "количество" = "Склад"."количество" + EXCLUDED."количество",
                        updated_at = CURRENT_TIMESTAMP
                `,
                [productId, assembledQty]
            );

            await runQuery(
                db,
                `
                    INSERT INTO "Движения_склада" (
                        "товар_id",
                        "тип_операции",
                        "количество",
                        "дата_операции",
                        "заявка_id",
                        "комментарий"
                    ) VALUES ($1, 'приход', $2, CURRENT_TIMESTAMP, $3, $4)
                `,
                [productId, assembledQty, orderId, `${reason}: возврат на склад позиции «${productName}»`]
            );
        }
    }

    await runQuery(
        db,
        'DELETE FROM public.order_assembly_batches WHERE order_id = $1',
        [orderId]
    );

    if (closeMissingProducts) {
        await runQuery(
            db,
            `
                UPDATE "Недостающие_товары"
                SET
                    "активна" = false,
                    "статус" = 'отменено',
                    "закрыто_в" = COALESCE("закрыто_в", CURRENT_TIMESTAMP)
                WHERE "заявка_id" = $1
                  AND COALESCE("активна", true) = true
            `,
            [orderId]
        );
    }

    if (detachOrderReferences) {
        await runQuery(
            db,
            'UPDATE "Движения_склада" SET "заявка_id" = NULL WHERE "заявка_id" = $1',
            [orderId]
        );

        await runQuery(
            db,
            'UPDATE "Финансы_компании" SET "заявка_id" = NULL WHERE "заявка_id" = $1',
            [orderId]
        );

        await runQuery(
            db,
            'UPDATE "Выплаты" SET "заявка_id" = NULL WHERE "заявка_id" = $1',
            [orderId]
        );
    }
}

export { normalizeStatus as normalizeFulfillmentStatus };
