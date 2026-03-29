import { query } from './db';
import { syncOrderWorkflowStatus } from './orderWorkflow';
import { normalizeOrderExecutionMode } from './orderModes';

const normalizeStatus = (value?: string | null) => (value || '').trim().toLowerCase();

async function normalizeMissingProductsForOrder(orderId: number) {
    const rows = await query(`
      SELECT id, "товар_id"
      FROM "Недостающие_товары"
      WHERE "заявка_id" = $1
      ORDER BY "товар_id", id DESC
    `, [orderId]);

    const keepIds: number[] = [];
    const archiveIds: number[] = [];
    const seenProductIds = new Set<number>();

    for (const row of rows.rows) {
        const productId = Number(row.товар_id);
        const rowId = Number(row.id);

        if (!seenProductIds.has(productId)) {
            seenProductIds.add(productId);
            keepIds.push(rowId);
        } else {
            archiveIds.push(rowId);
        }
    }

    if (keepIds.length > 0) {
        await query(
            `UPDATE "Недостающие_товары" SET "активна" = true WHERE id = ANY($1::int[])`,
            [keepIds]
        );
    }

    if (archiveIds.length > 0) {
        await query(
            `UPDATE "Недостающие_товары" SET "активна" = false WHERE id = ANY($1::int[])`,
            [archiveIds]
        );
    }
}

export async function syncMissingProductsFromPurchases(orderId: number) {
    await normalizeMissingProductsForOrder(orderId);

    const purchaseStatusesResult = await query(`
      SELECT
        пз."товар_id",
        MAX(CASE WHEN COALESCE(з."статус", 'заказано') = 'в пути' THEN 1 ELSE 0 END)::integer AS has_in_transit,
        MAX(CASE WHEN COALESCE(з."статус", 'заказано') = 'заказано' THEN 1 ELSE 0 END)::integer AS has_ordered
      FROM "Закупки" з
      INNER JOIN "Позиции_закупки" пз ON пз."закупка_id" = з.id
      WHERE з."заявка_id" = $1
        AND COALESCE(з."статус", 'заказано') != 'отменено'
      GROUP BY пз."товар_id"
    `, [orderId]);

    const statusByProduct = new Map<number, { hasInTransit: boolean; hasOrdered: boolean }>();

    for (const row of purchaseStatusesResult.rows) {
        statusByProduct.set(Number(row.товар_id), {
            hasInTransit: Number(row.has_in_transit) > 0,
            hasOrdered: Number(row.has_ordered) > 0,
        });
    }

    const missingProductsResult = await query(`
      SELECT id, "товар_id", "недостающее_количество", COALESCE("статус", 'в обработке') AS статус
      FROM "Недостающие_товары"
      WHERE "заявка_id" = $1
        AND COALESCE("активна", true) = true
      ORDER BY id
    `, [orderId]);

    for (const missingProduct of missingProductsResult.rows) {
        const productId = Number(missingProduct.товар_id);
        const missingQty = Number(missingProduct.недостающее_количество) || 0;
        const currentStatus = normalizeStatus(missingProduct.статус);
        const relatedStatus = statusByProduct.get(productId);

        let nextStatus = currentStatus;
        let nextMissingQty = missingQty;

        if (missingQty <= 0) {
            nextStatus = 'получено';
            nextMissingQty = 0;
        } else if (relatedStatus?.hasInTransit) {
            nextStatus = 'в пути';
        } else if (relatedStatus?.hasOrdered) {
            nextStatus = 'заказано';
        } else {
            nextStatus = 'в обработке';
        }

        if (nextStatus !== currentStatus || nextMissingQty !== missingQty) {
            await query(`
        UPDATE "Недостающие_товары"
        SET "статус" = $1,
            "недостающее_количество" = $2
        WHERE id = $3
      `, [nextStatus, nextMissingQty, missingProduct.id]);
        }
    }
}

export async function syncOrderStatusWithMissingProducts(orderId: number) {
    await syncMissingProductsFromPurchases(orderId);
    await syncOrderWorkflowStatus(orderId);
}

export async function downgradeOrderToInProgressIfNeeded(orderId: number) {
    await query(`
      UPDATE "Заявки"
      SET "статус" = 'в работе'
      WHERE id = $1
        AND "статус" IN ('собрана', 'досборка', 'отгружена', 'доотгрузка', 'выполнена')
    `, [orderId]);
}

export async function deactivateMissingProductsForOrder(orderId: number) {
    await query(`
      UPDATE "Недостающие_товары"
      SET "недостающее_количество" = 0,
          "активна" = false,
          "статус" = CASE
              WHEN COALESCE("статус", '') = '' THEN 'не требуется'
              ELSE "статус"
          END
      WHERE "заявка_id" = $1
        AND COALESCE("активна", true) = true
    `, [orderId]);
}

/**
 * Check for missing products when creating or updating an order
 * This function compares the required quantities with available stock
 * and creates records in the "Недостающие_товары" table when needed
 */
export async function checkAndCreateMissingProducts(orderId: number) {
    try {
        const orderModeResult = await query(
            `
                SELECT "режим_исполнения"
                FROM "Заявки"
                WHERE id = $1
                LIMIT 1
            `,
            [orderId]
        );
        const executionMode = normalizeOrderExecutionMode(orderModeResult.rows[0]?.режим_исполнения);

        if (executionMode === 'direct') {
            await deactivateMissingProductsForOrder(orderId);
            await syncOrderWorkflowStatus(orderId);
            return;
        }

        await normalizeMissingProductsForOrder(orderId);
        // Get order positions
        const positionsResult = await query(`
      SELECT 
        pz."товар_id",
        pz."количество" as необходимое_количество,
        COALESCE(с."количество", 0) as доступное_количество,
        COALESCE(assembled.assembled_qty, 0) as собранное_количество
      FROM "Позиции_заявки" pz
      LEFT JOIN "Склад" с ON pz."товар_id" = с."товар_id"
      LEFT JOIN (
        SELECT
          positions.product_id,
          SUM(positions.quantity)::integer AS assembled_qty
        FROM public.order_assembly_batches batches
        INNER JOIN public.order_assembly_batch_positions positions ON positions.batch_id = batches.id
        WHERE batches.order_id = $1
        GROUP BY positions.product_id
      ) assembled ON assembled.product_id = pz."товар_id"
      WHERE pz."заявка_id" = $1
    `, [orderId]);

        // For each position, check if there's enough stock
        for (const position of positionsResult.rows) {
            const { товар_id, необходимое_количество, доступное_количество, собранное_количество } = position;
            const remainingRequired = Math.max(0, Number(необходимое_количество) - Number(собранное_количество || 0));
            const недостающее_количество = Math.max(0, remainingRequired - Number(доступное_количество || 0));
            const latestMissingResult = await query(`
        SELECT id
        FROM "Недостающие_товары"
        WHERE "заявка_id" = $1
          AND "товар_id" = $2
          AND COALESCE("активна", true) = true
        ORDER BY id DESC
        LIMIT 1
      `, [orderId, товар_id]);

            const latestMissingId = latestMissingResult.rows[0]?.id;

            // If there's not enough stock, create a missing product record
            if (недостающее_количество > 0) {
                try {
                    if (latestMissingId) {
                        await query(`
              UPDATE "Недостающие_товары"
              SET "необходимое_количество" = $1,
                  "недостающее_количество" = $2,
                  "статус" = 'в обработке',
                  "активна" = true
              WHERE id = $3
            `, [необходимое_количество, недостающее_количество, latestMissingId]);
                    } else {
                        await query(`
              INSERT INTO "Недостающие_товары" (
                "заявка_id",
                "товар_id",
                "необходимое_количество",
                "недостающее_количество",
                "статус",
                "активна"
              ) VALUES ($1, $2, $3, $4, 'в обработке', true)
            `, [orderId, товар_id, необходимое_количество, недостающее_количество]);
                    }

                    await downgradeOrderToInProgressIfNeeded(orderId);
                } catch (error) {
                    console.error(`Error creating missing product record for order ${orderId}, product ${товар_id}:`, error);
                }
            } else if (latestMissingId) {
                await query(`
          UPDATE "Недостающие_товары"
          SET "необходимое_количество" = $1,
              "недостающее_количество" = 0,
              "статус" = 'получено',
              "активна" = true
          WHERE id = $2
        `, [необходимое_количество, latestMissingId]);
            }
        }

        await syncOrderStatusWithMissingProducts(orderId);
    } catch (error) {
        console.error(`Error checking missing products for order ${orderId}:`, error);
    }
}

/**
 * Check for missing products for a specific product and quantity
 * Used when manually checking stock levels
 */
export async function checkMissingProduct(orderId: number, productId: number, requiredQuantity: number) {
    try {
        await normalizeMissingProductsForOrder(orderId);
        // Get available stock
        const stockResult = await query(`
      SELECT COALESCE("количество", 0) as доступное_количество
      FROM "Склад"
      WHERE "товар_id" = $1
    `, [productId]);

        const availableQuantity = stockResult.rows[0]?.доступное_количество || 0;
            const assembledResult = await query(`
      SELECT COALESCE(SUM(positions.quantity), 0)::integer AS assembled_quantity
      FROM public.order_assembly_batches batches
      INNER JOIN public.order_assembly_batch_positions positions ON positions.batch_id = batches.id
      WHERE batches.order_id = $1 AND positions.product_id = $2
    `, [orderId, productId]);

        const assembledQuantity = Number(assembledResult.rows[0]?.assembled_quantity) || 0;
        const remainingRequired = Math.max(0, requiredQuantity - assembledQuantity);
        const missingQuantity = Math.max(0, remainingRequired - availableQuantity);
        const latestMissingResult = await query(`
      SELECT id
      FROM "Недостающие_товары"
      WHERE "заявка_id" = $1
        AND "товар_id" = $2
        AND COALESCE("активна", true) = true
      ORDER BY id DESC
      LIMIT 1
    `, [orderId, productId]);

        const latestMissingId = latestMissingResult.rows[0]?.id;

        // If there's not enough stock, create or update a missing product record
        if (missingQuantity > 0) {
            let result;

            if (latestMissingId) {
                result = await query(`
          UPDATE "Недостающие_товары"
          SET "необходимое_количество" = $1,
              "недостающее_количество" = $2,
              "статус" = 'в обработке',
              "активна" = true
          WHERE id = $3
          RETURNING *
        `, [requiredQuantity, missingQuantity, latestMissingId]);
            } else {
                result = await query(`
          INSERT INTO "Недостающие_товары" (
            "заявка_id",
            "товар_id",
            "необходимое_количество",
            "недостающее_количество",
            "статус",
            "активна"
          ) VALUES ($1, $2, $3, $4, 'в обработке', true)
          RETURNING *
        `, [orderId, productId, requiredQuantity, missingQuantity]);
            }

            await downgradeOrderToInProgressIfNeeded(orderId);

            await syncOrderStatusWithMissingProducts(orderId);

            return result.rows[0];
        } else if (latestMissingId) {
            await query(`
        UPDATE "Недостающие_товары"
        SET "необходимое_количество" = $1,
            "недостающее_количество" = 0,
            "статус" = 'получено',
            "активна" = true
        WHERE id = $2
      `, [requiredQuantity, latestMissingId]);

            await syncOrderStatusWithMissingProducts(orderId);

            return null;
        }

        return null;
    } catch (error) {
        console.error(`Error checking missing product for order ${orderId}, product ${productId}:`, error);
        throw error;
    }
}
