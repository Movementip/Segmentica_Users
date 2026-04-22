import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { downgradeOrderToInProgressIfNeeded, syncOrderStatusWithMissingProducts } from '../../lib/missingProductsHelper';
import { requireAuth, requirePermission } from '../../lib/auth';

interface MissingProduct {
    id: number;
    заявка_id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
    товар_название?: string;
    товар_артикул?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { order_id } = req.query;

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, order_id ? 'orders.view' : 'missing_products.list');
        if (!actor) return;
        try {
            let queryText = '';
            let queryParams: any[] = [];

            if (order_id) {
                // Get missing products for a specific order
                queryText = `
          WITH latest_missing AS (
            SELECT DISTINCT ON (nt."товар_id")
              nt.*,
              т."название" as товар_название,
              т."артикул" as товар_артикул
            FROM "Недостающие_товары" nt
            LEFT JOIN "Товары" т ON nt."товар_id" = т.id
            WHERE nt."заявка_id" = $1
            ORDER BY nt."товар_id", COALESCE(nt."активна", true) DESC, nt.id DESC
          )
          SELECT *
          FROM latest_missing
          ORDER BY id DESC
        `;
                queryParams = [order_id];
            } else {
                // Get all missing products with product information
                queryText = `
          SELECT 
            nt.*,
            т."название" as товар_название,
            т."артикул" as товар_артикул
          FROM "Недостающие_товары" nt
          LEFT JOIN "Товары" т ON nt."товар_id" = т.id
          ORDER BY nt.id DESC
        `;
            }

            const result = await query(queryText, queryParams);

            res.status(200).json(result.rows);
        } catch (error) {
            console.error('Error fetching missing products:', error);
            res.status(500).json({ error: 'Failed to fetch missing products: ' + (error instanceof Error ? error.message : 'Unknown error') });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'missing_products.create');
        if (!actor) return;
        try {
            const { заявка_id, товар_id, необходимое_количество, недостающее_количество } = req.body;

            // Validate required fields
            if (
                заявка_id == null
                || товар_id == null
                || необходимое_количество == null
                || недостающее_количество == null
            ) {
                return res.status(400).json({
                    error: 'Заявка, товар, необходимое количество и недостающее количество обязательны'
                });
            }

            const requiredQty = Number(необходимое_количество);
            const missingQty = Number(недостающее_количество);

            if (!Number.isFinite(requiredQty) || requiredQty <= 0) {
                return res.status(400).json({ error: 'Необходимое количество должно быть больше 0' });
            }

            if (!Number.isFinite(missingQty) || missingQty < 0) {
                return res.status(400).json({ error: 'Недостающее количество не может быть отрицательным' });
            }

            // Check if order exists
            const orderCheck = await query(
                'SELECT id FROM "Заявки" WHERE id = $1',
                [заявка_id]
            );

            if (orderCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Заявка не найдена' });
            }

            // Check if product exists
            const productCheck = await query(
                'SELECT id FROM "Товары" WHERE id = $1',
                [товар_id]
            );

            if (productCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Товар не найден' });
            }

            const existingMissingProduct = await query(`
        SELECT id
        FROM "Недостающие_товары"
        WHERE "заявка_id" = $1
          AND "товар_id" = $2
          AND COALESCE("статус", 'в обработке') != 'получено'
          AND "недостающее_количество" > 0
        ORDER BY id DESC
        LIMIT 1
        `, [заявка_id, товар_id]);

            let result;

            if (existingMissingProduct.rows.length > 0) {
                result = await query(`
          UPDATE "Недостающие_товары"
          SET "необходимое_количество" = $1,
              "недостающее_количество" = $2,
              "статус" = CASE
                WHEN $2 > 0 THEN 'в обработке'
                ELSE 'получено'
              END
          WHERE id = $3
          RETURNING *
        `, [requiredQty, missingQty, existingMissingProduct.rows[0].id]);
            } else {
                result = await query(`
          INSERT INTO "Недостающие_товары" (
            "заявка_id", "товар_id", "необходимое_количество", "недостающее_количество", "статус"
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [заявка_id, товар_id, requiredQty, missingQty, missingQty > 0 ? 'в обработке' : 'получено']);
            }

            if (missingQty > 0) {
                await downgradeOrderToInProgressIfNeeded(заявка_id);
            }

            await syncOrderStatusWithMissingProducts(заявка_id);

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error adding missing product:', error);
            res.status(500).json({
                error: 'Ошибка добавления недостающего товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'missing_products.edit');
        if (!actor) return;
        try {
            const { id, заявка_id, товар_id, необходимое_количество, недостающее_количество, статус } = req.body;

            // Allow partial status update: { id, статус }
            const isStatusOnlyUpdate =
                id != null &&
                статус &&
                заявка_id == null &&
                товар_id == null &&
                необходимое_количество == null &&
                недостающее_количество == null;

            if (isStatusOnlyUpdate) {
                const existing = await query(
                    'SELECT id, "заявка_id", "недостающее_количество" FROM "Недостающие_товары" WHERE id = $1',
                    [id]
                );

                if (existing.rows.length === 0) {
                    return res.status(404).json({ error: 'Недостающий товар не найден' });
                }

                const orderId = Number(existing.rows[0].заявка_id);
                const nextMissingQty = статус === 'получено' ? 0 : Number(existing.rows[0].недостающее_количество);

                const result = await query(
                    `
        UPDATE "Недостающие_товары"
        SET
          "статус" = $1,
          "недостающее_количество" = $2
        WHERE id = $3
        RETURNING *
      `,
                    [статус, nextMissingQty, id]
                );

                if (nextMissingQty > 0) {
                    await downgradeOrderToInProgressIfNeeded(orderId);
                }

                await syncOrderStatusWithMissingProducts(orderId);

                return res.status(200).json(result.rows[0]);
            }

            // Validate required fields
            if (
                id == null ||
                заявка_id == null ||
                товар_id == null ||
                необходимое_количество == null ||
                недостающее_количество == null ||
                !статус
            ) {
                return res.status(400).json({
                    error: 'ID, заявка, товар, необходимое количество, недостающее количество и статус обязательны'
                });
            }

            const requiredQty = Number(необходимое_количество);
            const missingQty = Number(недостающее_количество);

            if (!Number.isFinite(requiredQty) || requiredQty <= 0) {
                return res.status(400).json({ error: 'Необходимое количество должно быть больше 0' });
            }

            if (!Number.isFinite(missingQty) || missingQty < 0) {
                return res.status(400).json({ error: 'Недостающее количество не может быть отрицательным' });
            }

            const orderCheck = await query(
                'SELECT id FROM "Заявки" WHERE id = $1',
                [заявка_id]
            );

            if (orderCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Заявка не найдена' });
            }

            const productCheck = await query(
                'SELECT id FROM "Товары" WHERE id = $1',
                [товар_id]
            );

            if (productCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Товар не найден' });
            }

            const existingRecordResult = await query(
                'SELECT id, "заявка_id" FROM "Недостающие_товары" WHERE id = $1',
                [id]
            );

            if (existingRecordResult.rows.length === 0) {
                return res.status(404).json({ error: 'Недостающий товар не найден' });
            }

            const previousOrderId = Number(existingRecordResult.rows[0].заявка_id);

            // Update missing product
            const result = await query(`
        UPDATE "Недостающие_товары" 
        SET
          "заявка_id" = $1,
          "товар_id" = $2,
          "необходимое_количество" = $3,
          "недостающее_количество" = $4,
          "статус" = $5
        WHERE id = $6
        RETURNING *
      `, [заявка_id, товар_id, requiredQty, missingQty, статус, id]);

            if (missingQty > 0) {
                await downgradeOrderToInProgressIfNeeded(заявка_id);
            }

            const orderIdsToSync = new Set<number>([previousOrderId, Number(заявка_id)]);
            for (const orderId of Array.from(orderIdsToSync)) {
                await syncOrderStatusWithMissingProducts(orderId);
            }

            res.status(200).json(result.rows[0]);
        } catch (error) {
            console.error('Error updating missing product:', error);
            res.status(500).json({
                error: 'Ошибка обновления недостающего товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'missing_products.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID обязателен' });
            }

            const existingMissing = await query(
                'SELECT id, "заявка_id" FROM "Недостающие_товары" WHERE id = $1',
                [id]
            );

            if (existingMissing.rows.length === 0) {
                return res.status(404).json({ error: 'Недостающий товар не найден' });
            }

            const orderId = Number(existingMissing.rows[0].заявка_id);
            const result = await query(
                'DELETE FROM "Недостающие_товары" WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Недостающий товар не найден' });
            }

            await syncOrderStatusWithMissingProducts(orderId);

            res.status(200).json({ message: 'Недостающий товар успешно удален' });
        } catch (error) {
            console.error('Error deleting missing product:', error);
            res.status(500).json({
                error: 'Ошибка удаления недостающего товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
