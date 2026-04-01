import { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

const PRODUCT_NOMENCLATURE_TYPES = new Set([
    'товар',
    'материал',
    'продукция',
    'входящая_услуга',
    'исходящая_услуга',
    'внеоборотный_актив'
]);

const DEFAULT_PRODUCT_NOMENCLATURE_TYPE = 'товар';
const ALLOWED_PRODUCT_VAT_RATE_IDS = new Set([1, 4, 5]);
const DEFAULT_PRODUCT_VAT_RATE_ID = 5;

const normalizeNullableText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const normalizeNomenclatureType = (value: unknown): string => {
    const normalized = normalizeNullableText(value);
    if (!normalized) return DEFAULT_PRODUCT_NOMENCLATURE_TYPE;
    return PRODUCT_NOMENCLATURE_TYPES.has(normalized) ? normalized : DEFAULT_PRODUCT_NOMENCLATURE_TYPE;
};

const normalizeProductVatRateId = (value: unknown): number => {
    const id = Number(value);
    return ALLOWED_PRODUCT_VAT_RATE_IDS.has(id) ? id : DEFAULT_PRODUCT_VAT_RATE_ID;
};

const normalizeCategoryId = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

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
            WHEN т."минимальный_остаток" > 0 AND с."количество" <= т."минимальный_остаток" THEN 'critical'
            WHEN т."минимальный_остаток" > 0 AND с."количество" <= т."минимальный_остаток" * 2 THEN 'low' 
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
          зак."id" as закупка_номер,
          отг."id" as отгрузка_номер
        FROM "Движения_склада" дс
        LEFT JOIN "Товары" т ON дс."товар_id" = т.id
        LEFT JOIN "Заявки" з ON дс."заявка_id" = з.id
        LEFT JOIN "Закупки" зак ON дс."закупка_id" = зак.id
        LEFT JOIN "Отгрузки" отг ON дс."отгрузка_id" = отг.id
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
            WHEN т."минимальный_остаток" > 0 AND с."количество" <= т."минимальный_остаток" THEN 'critical'
            WHEN т."минимальный_остаток" > 0 AND с."количество" <= т."минимальный_остаток" * 2 THEN 'low' 
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
                категория,
                тип_номенклатуры,
                счет_учета,
                счет_затрат,
                ндс_id,
                комментарий,
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

            const resolvedCategoryId = normalizeCategoryId(категория_id);
            const normalizedType = normalizeNomenclatureType(тип_номенклатуры);
            const normalizedAccountingAccount = normalizedType === 'материал' ? normalizeNullableText(счет_учета) : null;
            const normalizedExpenseAccount = normalizedType === 'входящая_услуга' ? normalizeNullableText(счет_затрат) : null;
            const normalizedVatRateId = normalizeProductVatRateId(ндс_id);
            const normalizedComment = normalizeNullableText(комментарий);

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const txQuery = (text: string, params?: any[]) => client.query(text, params);
                let resolvedCategoryName = normalizeNullableText(категория);

                if (resolvedCategoryId) {
                    const categoryResult = await txQuery(
                        'SELECT "название" FROM "Категории_товаров" WHERE id = $1',
                        [resolvedCategoryId]
                    );
                    resolvedCategoryName = categoryResult.rows[0]?.название || resolvedCategoryName;
                }

                // Create product
                const productResult = await txQuery(`
          INSERT INTO "Товары" (
            "название", "артикул", "категория", "тип_номенклатуры", "счет_учета", "счет_затрат",
            "ндс_id", "комментарий", "категория_id", "единица_измерения",
            "минимальный_остаток", "цена_закупки", "цена_продажи"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, [
                    normalizeNullableText(название),
                    normalizeNullableText(артикул),
                    resolvedCategoryName,
                    normalizedType,
                    normalizedAccountingAccount,
                    normalizedExpenseAccount,
                    normalizedVatRateId,
                    normalizedComment,
                    resolvedCategoryId,
                    normalizeNullableText(единица_измерения) || 'шт',
                    минимальный_остаток || 0,
                    цена_закупки || 0,
                    цена_продажи || 0
                ]);

                const productId = productResult.rows[0].id;

                await txQuery(
                    `
                        INSERT INTO "История_цен_товаров" (
                            "товар_id",
                            "цена_закупки",
                            "цена_продажи",
                            "источник",
                            "комментарий"
                        )
                        VALUES ($1, $2, $3, $4, $5)
                    `,
                    [productId, цена_закупки || 0, цена_продажи || 0, 'product_create', 'Начальное создание товара']
                );

                // Add to warehouse with initial quantity
                const warehouseInsertQuery = начальное_количество > 0
                    ? `INSERT INTO "Склад" ("товар_id", "количество", "дата_последнего_поступления")
             VALUES ($1, $2, CURRENT_TIMESTAMP)`
                    : `INSERT INTO "Склад" ("товар_id", "количество")
             VALUES ($1, $2)`;

                await txQuery(warehouseInsertQuery, [productId, начальное_количество || 0]);

                await client.query('COMMIT');
                res.status(201).json({ message: 'Товар успешно создан', productId });
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
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

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const warehouseItem = await client.query(
                    'SELECT * FROM "Склад" WHERE id = $1 FOR UPDATE',
                    [id]
                );

                if (warehouseItem.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Товар не найден на складе' });
                }

                const товарId = Number(warehouseItem.rows[0].товар_id);
                const referenceCheck = await client.query(
                    `
                        SELECT
                          EXISTS(SELECT 1 FROM "Позиции_заявки" WHERE "товар_id" = $1) AS has_order_positions,
                          EXISTS(SELECT 1 FROM "Позиции_закупки" WHERE "товар_id" = $1) AS has_purchase_positions,
                          EXISTS(SELECT 1 FROM public.shipment_positions WHERE product_id = $1) AS has_shipment_positions,
                          EXISTS(SELECT 1 FROM public.order_assembly_batch_positions WHERE product_id = $1) AS has_assembly_positions,
                          EXISTS(SELECT 1 FROM "Недостающие_товары" WHERE "товар_id" = $1) AS has_missing_products
                    `,
                    [товарId]
                );

                const refs = referenceCheck.rows[0] || {};
                if (refs.has_order_positions || refs.has_purchase_positions || refs.has_shipment_positions || refs.has_assembly_positions || refs.has_missing_products) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        error: 'Нельзя удалить товар: он уже участвует в заявках, закупках, отгрузках, сборках или недостачах'
                    });
                }

                await client.query('DELETE FROM "Ассортимент_поставщиков" WHERE "товар_id" = $1', [товарId]);
                await client.query('DELETE FROM "Движения_склада" WHERE "товар_id" = $1', [товарId]);
                await client.query('DELETE FROM "Склад" WHERE id = $1', [id]);
                await client.query('DELETE FROM "Товары" WHERE id = $1', [товарId]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Товар успешно удален' });
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }
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

            const resolvedCategoryName: string | null = typeof категория === 'string' && категория.trim() ? категория.trim() : null;
            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const txQuery = (text: string, params?: any[]) => client.query(text, params);
                let resolvedCategoryId: number | null = null;

                if (typeof категория_id === 'number') {
                    resolvedCategoryId = категория_id;
                } else if (typeof категория_id === 'string' && категория_id.trim()) {
                    const asNum = Number(категория_id);
                    resolvedCategoryId = Number.isFinite(asNum) ? asNum : null;
                } else if (resolvedCategoryName) {
                    const categoryName = resolvedCategoryName;
                    const existingCategory = await txQuery(
                        'SELECT id FROM "Категории_товаров" WHERE "название" = $1 LIMIT 1',
                        [categoryName]
                    );
                    if (existingCategory.rows.length > 0) {
                        resolvedCategoryId = existingCategory.rows[0].id;
                    } else {
                        const insertedCategory = await txQuery(
                            'INSERT INTO "Категории_товаров" ("название") VALUES ($1) RETURNING id',
                            [categoryName]
                        );
                        resolvedCategoryId = insertedCategory.rows[0].id;
                    }
                }

                // Update product information
                const updateResult = await txQuery(`
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
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Товар не найден' });
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Товар успешно обновлен' });
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ error: 'Ошибка обновления товара' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
