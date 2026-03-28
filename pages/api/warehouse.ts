import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'warehouse.list');
        if (!actor) return;
        try {
            // Get all warehouse items with product information and stock status
            const warehouseResult = await query(`
        SELECT 
          с.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          кт."название" as товар_категория,
          т."единица_измерения" as товар_единица,
          т."минимальный_остаток" as товар_мин_остаток,
          т."цена_закупки" as товар_цена_закупки,
          т."цена_продажи" as товар_цена_продажи,
          CASE 
            WHEN с."количество" <= т."минимальный_остаток" THEN 'critical'
            WHEN с."количество" <= т."минимальный_остаток" * 2 THEN 'low' 
            ELSE 'normal'
          END as stock_status
        FROM "Склад" с
        JOIN "Товары" т ON с."товар_id" = т.id
        LEFT JOIN "Категории_товаров" кт ON т."категория_id" = кт.id
        ORDER BY с."количество" ASC, т."название" ASC
      `);

            // Get warehouse movements (RBAC: warehouse.movements.view)
            const movementsResult = actor.permissions?.includes('warehouse.movements.view')
                ? await query(`
        SELECT 
          дс.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          з."id" as заявка_номер,
          зак."id" as закупка_номер
        FROM "Движения_склада" дс
        LEFT JOIN "Товары" т ON дс."товар_id" = т.id
        LEFT JOIN "Заявки" з ON дс."заявка_id" = з.id
        LEFT JOIN "Закупки" зак ON дс."закупка_id" = зак.id
        ORDER BY дс."дата_операции" DESC
      `)
                : { rows: [] as any[] };

            // Get low stock items (RBAC: warehouse.critical.view)
            const lowStockResult = actor.permissions?.includes('warehouse.critical.view')
                ? await query(`
        SELECT 
          с.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          кт."название" as товар_категория,
          т."единица_измерения" as товар_единица,
          т."минимальный_остаток" as товар_мин_остаток,
          т."цена_закупки" as товар_цена_закупки,
          т."цена_продажи" as товар_цена_продажи,
          CASE 
            WHEN с."количество" <= т."минимальный_остаток" THEN 'critical'
            WHEN с."количество" <= т."минимальный_остаток" * 2 THEN 'low' 
            ELSE 'normal'
          END as stock_status
        FROM "Склад" с
        JOIN "Товары" т ON с."товар_id" = т.id
        LEFT JOIN "Категории_товаров" кт ON т."категория_id" = кт.id
        WHERE т."минимальный_остаток" > 0
          AND с."количество" <= т."минимальный_остаток"
        ORDER BY (с."количество"::float / NULLIF(т."минимальный_остаток"::float, 0)) ASC
      `)
                : { rows: [] as any[] };

            res.status(200).json({
                warehouse: warehouseResult.rows,
                movements: movementsResult.rows,
                lowStock: lowStockResult.rows
            });
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
            res.status(500).json({ error: 'Failed to fetch warehouse data' });
        }
    } else if (req.method === 'POST') {
        // Create new product and add to warehouse
        const actor1 = await requirePermission(req, res, 'warehouse.create');
        if (!actor1) return;
        const actor2 = await requirePermission(req, res, 'products.create');
        if (!actor2) return;
        try {
            const {
                название,
                артикул,
                категория_id,
                единица_измерения,
                минимальный_остаток,
                цена_закупки,
                цена_продажи,
                начальное_количество
            } = req.body;

            // Validate required fields
            if (!название || !артикул || !единица_измерения) {
                return res.status(400).json({ error: 'Название, артикул и единица измерения обязательны' });
            }

            // Check if product with this артикул already exists
            const existingProduct = await query(
                'SELECT id FROM "Товары" WHERE "артикул" = $1',
                [артикул]
            );

            if (existingProduct.rows.length > 0) {
                return res.status(400).json({ error: 'Товар с таким артикулом уже существует' });
            }

            // Start transaction
            await query('BEGIN');

            try {
                // Create product
                const productResult = await query(`
          INSERT INTO "Товары" (
            "название", "артикул", "категория_id", "единица_измерения",
            "минимальный_остаток", "цена_закупки", "цена_продажи"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
                    название,
                    артикул,
                    категория_id || 1, // Default to category 1 (Electronics)
                    единица_измерения,
                    минимальный_остаток || 0,
                    цена_закупки || 0,
                    цена_продажи || 0
                ]);

                const productId = productResult.rows[0].id;

                // Add to warehouse with initial quantity
                const warehouseInsertQuery = начальное_количество > 0
                    ? `INSERT INTO "Склад" ("товар_id", "количество", "дата_последнего_поступления")
             VALUES ($1, $2, CURRENT_TIMESTAMP)`
                    : `INSERT INTO "Склад" ("товар_id", "количество")
             VALUES ($1, $2)`;

                await query(warehouseInsertQuery, [productId, начальное_количество || 0]);

                // Commit transaction
                await query('COMMIT');
                res.status(201).json({ message: 'Товар успешно создан', productId });
            } catch (transactionError) {
                // Rollback transaction on error
                await query('ROLLBACK');
                throw transactionError;
            }
        } catch (error) {
            console.error('Error creating product:', error);
            console.error('Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            res.status(500).json({
                error: 'Ошибка создания товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        // Remove product from warehouse and products table
        const actor = await requirePermission(req, res, 'warehouse.edit');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID товара обязателен' });
            }

            // Check if product exists in warehouse
            const warehouseItem = await query(
                'SELECT * FROM "Склад" WHERE id = $1',
                [id]
            );

            if (warehouseItem.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден на складе' });
            }

            const товарId = warehouseItem.rows[0].товар_id;

            // Remove from warehouse
            await query('DELETE FROM "Склад" WHERE id = $1', [id]);

            // Remove all movements for this product
            await query('DELETE FROM "Движения_склада" WHERE "товар_id" = $1', [товарId]);

            // Remove product from products table
            await query('DELETE FROM "Товары" WHERE id = $1', [товарId]);

            res.status(200).json({ message: 'Товар успешно удален' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({ error: 'Ошибка удаления товара' });
        }
    } else if (req.method === 'PUT') {
        // Update product information
        const actor = await requirePermission(req, res, 'warehouse.edit');
        if (!actor) return;
        try {
            const {
                id,
                название,
                артикул,
                категория,
                категория_id,
                единица_измерения,
                минимальный_остаток,
                цена_закупки,
                цена_продажи
            } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'ID товара обязателен' });
            }

            let resolvedCategoryId: number | null = null;
            const resolvedCategoryName: string | null = typeof категория === 'string' && категория.trim() ? категория.trim() : null;
            if (typeof категория_id === 'number') {
                resolvedCategoryId = категория_id;
            } else if (typeof категория_id === 'string' && категория_id.trim()) {
                const asNum = Number(категория_id);
                resolvedCategoryId = Number.isFinite(asNum) ? asNum : null;
            } else if (resolvedCategoryName) {
                const categoryName = resolvedCategoryName;
                const existingCategory = await query(
                    'SELECT id FROM "Категории_товаров" WHERE "название" = $1 LIMIT 1',
                    [categoryName]
                );
                if (existingCategory.rows.length > 0) {
                    resolvedCategoryId = existingCategory.rows[0].id;
                } else {
                    const insertedCategory = await query(
                        'INSERT INTO "Категории_товаров" ("название") VALUES ($1) RETURNING id',
                        [categoryName]
                    );
                    resolvedCategoryId = insertedCategory.rows[0].id;
                }
            }

            // Update product information
            const updateResult = await query(`
        UPDATE "Товары" SET
          "название" = $1,
          "артикул" = $2,
          "категория" = $3,
          "категория_id" = $4,
          "единица_измерения" = $5,
          "минимальный_остаток" = $6,
          "цена_закупки" = $7,
          "цена_продажи" = $8
        WHERE id = $9
      `, [
                название,
                артикул,
                resolvedCategoryName,
                resolvedCategoryId,
                единица_измерения,
                минимальный_остаток || 0,
                цена_закупки || 0,
                цена_продажи || 0,
                id
            ]);

            if (updateResult.rowCount === 0) {
                return res.status(404).json({ error: 'Товар не найден' });
            }

            res.status(200).json({ message: 'Товар успешно обновлен' });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ error: 'Ошибка обновления товара' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}