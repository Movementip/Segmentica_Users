import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

export interface Product {
    id: number;
    название: string;
    артикул: string;
    категория?: string;
    тип_номенклатуры: string;
    счет_учета?: string;
    счет_затрат?: string;
    ндс_id: number;
    комментарий?: string;
    цена_закупки?: number;
    цена_продажи: number;
    единица_измерения: string;
    минимальный_остаток: number;
    created_at: string;
    категория_id?: number;
    история_цен?: ProductPriceHistory[];
}

interface ProductPriceHistory {
    id: number;
    товар_id: number;
    цена_закупки?: number;
    цена_продажи?: number;
    изменено_в: string;
    источник?: string;
    комментарий?: string;
}

interface CreateProductRequest {
    название: string;
    артикул: string;
    категория?: string;
    тип_номенклатуры?: string;
    счет_учета?: string;
    счет_затрат?: string;
    ндс_id?: number;
    комментарий?: string;
    цена_закупки?: number;
    цена_продажи: number;
    единица_измерения?: string;
    минимальный_остаток?: number;
    категория_id?: number;
}

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

const resolveCategoryName = async (categoryId: number | null, fallbackName?: unknown) => {
    if (!categoryId) return normalizeNullableText(fallbackName);

    const categoryResult = await query(
        'SELECT "название" FROM "Категории_товаров" WHERE id = $1',
        [categoryId]
    );

    return categoryResult.rows[0]?.название || normalizeNullableText(fallbackName);
};

const mapProductRow = (row: any): Product => ({
    id: row.id,
    название: row.название,
    артикул: row.артикул,
    категория: row.категория || row.категория_название || undefined,
    тип_номенклатуры: row.тип_номенклатуры || DEFAULT_PRODUCT_NOMENCLATURE_TYPE,
    счет_учета: row.счет_учета || undefined,
    счет_затрат: row.счет_затрат || undefined,
    ндс_id: Number(row.ндс_id) || DEFAULT_PRODUCT_VAT_RATE_ID,
    комментарий: row.комментарий || undefined,
    цена_закупки: row.цена_закупки !== null && row.цена_закупки !== undefined ? parseFloat(row.цена_закупки) : undefined,
    цена_продажи: parseFloat(row.цена_продажи) || 0,
    единица_измерения: row.единица_измерения,
    минимальный_остаток: row.минимальный_остаток,
    created_at: row.created_at,
    категория_id: row.категория_id,
    история_цен: row.история_цен,
});

const mapHistoryRow = (row: any): ProductPriceHistory => ({
    id: row.id,
    товар_id: row.товар_id,
    цена_закупки: row.цена_закупки !== null && row.цена_закупки !== undefined ? parseFloat(row.цена_закупки) : undefined,
    цена_продажи: row.цена_продажи !== null && row.цена_продажи !== undefined ? parseFloat(row.цена_продажи) : undefined,
    изменено_в: row.изменено_в,
    источник: row.источник || undefined,
    комментарий: row.комментарий || undefined,
});

const createPriceHistoryRecord = async (
    товарId: number,
    ценаЗакупки: number | null | undefined,
    ценаПродажи: number | null | undefined,
    источник: string,
    комментарий?: string
) => {
    await query(
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
        [товарId, ценаЗакупки ?? null, ценаПродажи ?? null, источник, комментарий ?? null]
    );
};

interface UpdateProductRequest {
    id: number;
    название?: string;
    артикул?: string;
    категория?: string;
    тип_номенклатуры?: string;
    счет_учета?: string;
    счет_затрат?: string;
    ндс_id?: number;
    комментарий?: string;
    цена_закупки?: number;
    цена_продажи?: number;
    единица_измерения?: string;
    минимальный_остаток?: number;
    категория_id?: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Product[] | Product | { error: string } | { message: string }>
) {
    if (req.method === 'GET') {
        const { id } = req.query;

        const actor = await requirePermission(req, res, id ? 'products.view' : 'products.list');
        if (!actor) return;
        try {
            if (id) {
                const includePriceHistoryRaw = req.query.include_price_history;
                const includePriceHistory =
                    String(Array.isArray(includePriceHistoryRaw) ? includePriceHistoryRaw[0] : includePriceHistoryRaw)
                        .trim() === '1';

                if (includePriceHistory && !actor.permissions?.includes('products.price_history.view')) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                // Fetch single product by ID
                const result = await query(
                    `
                        SELECT t.*, кт."название" AS категория_название
                        FROM "Товары" t
                        LEFT JOIN "Категории_товаров" кт ON t."категория_id" = кт.id
                        WHERE t.id = $1
                    `,
                    [id]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Товар не найден' });
                }

                const historyResult = includePriceHistory
                    ? await query(
                        `
            SELECT *
            FROM "История_цен_товаров"
            WHERE "товар_id" = $1
            ORDER BY "изменено_в" DESC, id DESC
          `,
                        [id]
                    )
                    : { rows: [] as any[] };

                const product: Product = mapProductRow({
                    ...result.rows[0],
                    история_цен: historyResult.rows.map(mapHistoryRow)
                });

                res.status(200).json(product);
            } else {
                // Fetch all products
                const result = await query(`
          SELECT t.*, кт."название" AS категория_название
          FROM "Товары" t
          LEFT JOIN "Категории_товаров" кт ON t."категория_id" = кт.id
          ORDER BY "название"
        `);

                const products: Product[] = result.rows.map((row: any) => mapProductRow(row));

                res.status(200).json(products);
            }
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения товаров: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'products.create');
        if (!actor) return;
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
                цена_закупки,
                цена_продажи,
                единица_измерения,
                минимальный_остаток,
                категория_id
            } = req.body as CreateProductRequest;

            const normalizedCategoryId = normalizeCategoryId(категория_id);
            const normalizedCategoryName = await resolveCategoryName(normalizedCategoryId, категория);
            const normalizedType = normalizeNomenclatureType(тип_номенклатуры);
            const normalizedAccountingAccount = normalizedType === 'материал' ? normalizeNullableText(счет_учета) : null;
            const normalizedExpenseAccount = normalizedType === 'входящая_услуга' ? normalizeNullableText(счет_затрат) : null;
            const normalizedVatRateId = normalizeProductVatRateId(ндс_id);
            const normalizedComment = normalizeNullableText(комментарий);

            // Validate required fields
            if (!название || !артикул) {
                return res.status(400).json({ error: 'Название и артикул обязательны' });
            }

            // Check if product with this article already exists
            const existingProduct = await query(
                'SELECT id FROM "Товары" WHERE "артикул" = $1',
                [артикул]
            );

            if (existingProduct.rows.length > 0) {
                return res.status(400).json({ error: 'Товар с таким артикулом уже существует' });
            }

            // Create new product
            const result = await query(`
        INSERT INTO "Товары" (
            "название",
            "артикул",
            "категория",
            "тип_номенклатуры",
            "счет_учета",
            "счет_затрат",
            "ндс_id",
            "комментарий",
            "цена_закупки",
            "цена_продажи",
            "единица_измерения",
            "минимальный_остаток",
            "категория_id"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
                normalizeNullableText(название),
                normalizeNullableText(артикул),
                normalizedCategoryName,
                normalizedType,
                normalizedAccountingAccount,
                normalizedExpenseAccount,
                normalizedVatRateId,
                normalizedComment,
                цена_закупки ?? null,
                цена_продажи ?? 0,
                normalizeNullableText(единица_измерения) || 'шт',
                минимальный_остаток || 0,
                normalizedCategoryId
            ]);

            const newProduct: Product = mapProductRow(result.rows[0]);

            await createPriceHistoryRecord(
                result.rows[0].id,
                result.rows[0].цена_закупки,
                result.rows[0].цена_продажи,
                'product_create',
                'Начальное создание товара'
            );

            res.status(201).json(newProduct);
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({
                error: 'Ошибка создания товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'products.edit');
        if (!actor) return;
        try {
            const {
                id,
                название,
                артикул,
                категория,
                тип_номенклатуры,
                счет_учета,
                счет_затрат,
                ндс_id,
                комментарий,
                цена_закупки,
                цена_продажи,
                единица_измерения,
                минимальный_остаток,
                категория_id
            } = req.body as UpdateProductRequest;

            // Validate required fields
            if (!id) {
                return res.status(400).json({ error: 'ID товара обязателен' });
            }

            // Check if product exists
            const productCheck = await query(
                'SELECT id, "цена_закупки", "цена_продажи" FROM "Товары" WHERE id = $1',
                [id]
            );

            if (productCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден' });
            }

            // Check if another product with this article already exists
            if (артикул) {
                const existingProduct = await query(
                    'SELECT id FROM "Товары" WHERE "артикул" = $1 AND id != $2',
                    [артикул, id]
                );

                if (existingProduct.rows.length > 0) {
                    return res.status(400).json({ error: 'Товар с таким артикулом уже существует' });
                }
            }

            // Update product
            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (категория !== undefined || категория_id !== undefined) {
                const normalizedCategoryId = normalizeCategoryId(категория_id);
                const normalizedCategoryName = await resolveCategoryName(normalizedCategoryId, категория);

                updateFields.push(`"категория" = $${paramCount}`);
                values.push(normalizedCategoryName);
                paramCount++;

                updateFields.push(`"категория_id" = $${paramCount}`);
                values.push(normalizedCategoryId);
                paramCount++;
            }

            if (название !== undefined) {
                updateFields.push(`"название" = $${paramCount}`);
                values.push(normalizeNullableText(название));
                paramCount++;
            }

            if (артикул !== undefined) {
                updateFields.push(`"артикул" = $${paramCount}`);
                values.push(normalizeNullableText(артикул));
                paramCount++;
            }

            if (тип_номенклатуры !== undefined) {
                const normalizedType = normalizeNomenclatureType(тип_номенклатуры);

                updateFields.push(`"тип_номенклатуры" = $${paramCount}`);
                values.push(normalizedType);
                paramCount++;

                updateFields.push(`"счет_учета" = $${paramCount}`);
                values.push(normalizedType === 'материал' ? normalizeNullableText(счет_учета) : null);
                paramCount++;

                updateFields.push(`"счет_затрат" = $${paramCount}`);
                values.push(normalizedType === 'входящая_услуга' ? normalizeNullableText(счет_затрат) : null);
                paramCount++;
            }

            if (тип_номенклатуры === undefined && счет_учета !== undefined) {
                updateFields.push(`"счет_учета" = $${paramCount}`);
                values.push(normalizeNullableText(счет_учета));
                paramCount++;
            }

            if (тип_номенклатуры === undefined && счет_затрат !== undefined) {
                updateFields.push(`"счет_затрат" = $${paramCount}`);
                values.push(normalizeNullableText(счет_затрат));
                paramCount++;
            }

            if (ндс_id !== undefined) {
                updateFields.push(`"ндс_id" = $${paramCount}`);
                values.push(normalizeProductVatRateId(ндс_id));
                paramCount++;
            }

            if (комментарий !== undefined) {
                updateFields.push(`"комментарий" = $${paramCount}`);
                values.push(normalizeNullableText(комментарий));
                paramCount++;
            }

            if (цена_закупки !== undefined) {
                updateFields.push(`"цена_закупки" = $${paramCount}`);
                values.push(цена_закупки);
                paramCount++;
            }

            if (цена_продажи !== undefined) {
                updateFields.push(`"цена_продажи" = $${paramCount}`);
                values.push(цена_продажи);
                paramCount++;
            }

            if (единица_измерения !== undefined) {
                updateFields.push(`"единица_измерения" = $${paramCount}`);
                values.push(normalizeNullableText(единица_измерения) || 'шт');
                paramCount++;
            }

            if (минимальный_остаток !== undefined) {
                updateFields.push(`"минимальный_остаток" = $${paramCount}`);
                values.push(минимальный_остаток);
                paramCount++;
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            values.push(id);

            const result = await query(`
        UPDATE "Товары" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден' });
            }

            const previousPurchasePrice = productCheck.rows[0].цена_закупки !== null && productCheck.rows[0].цена_закупки !== undefined
                ? parseFloat(productCheck.rows[0].цена_закупки)
                : null;
            const previousSalePrice = productCheck.rows[0].цена_продажи !== null && productCheck.rows[0].цена_продажи !== undefined
                ? parseFloat(productCheck.rows[0].цена_продажи)
                : null;
            const nextPurchasePrice = result.rows[0].цена_закупки !== null && result.rows[0].цена_закупки !== undefined
                ? parseFloat(result.rows[0].цена_закупки)
                : null;
            const nextSalePrice = result.rows[0].цена_продажи !== null && result.rows[0].цена_продажи !== undefined
                ? parseFloat(result.rows[0].цена_продажи)
                : null;

            const priceChanged = previousPurchasePrice !== nextPurchasePrice || previousSalePrice !== nextSalePrice;

            if (priceChanged) {
                await createPriceHistoryRecord(
                    result.rows[0].id,
                    result.rows[0].цена_закупки,
                    result.rows[0].цена_продажи,
                    'product_update',
                    'Изменение цены товара'
                );
            }

            const updatedProduct: Product = mapProductRow(result.rows[0]);

            res.status(200).json(updatedProduct);
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({
                error: 'Ошибка обновления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'products.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID товара обязателен' });
            }

            // Check if product exists
            const productCheck = await query(
                'SELECT id FROM "Товары" WHERE id = $1',
                [id]
            );

            if (productCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден' });
            }

            // Check if product is used in any positions
            const positionsCheck1 = await query(
                'SELECT COUNT(*) as count FROM "Позиции_заявки" WHERE "товар_id" = $1',
                [id]
            );

            const positionsCheck2 = await query(
                'SELECT COUNT(*) as count FROM "Позиции_закупки" WHERE "товар_id" = $1',
                [id]
            );

            const positionsCheck3 = await query(
                'SELECT COUNT(*) as count FROM "Ассортимент_поставщиков" WHERE "товар_id" = $1',
                [id]
            );

            const totalPositions = parseInt(positionsCheck1.rows[0].count) +
                parseInt(positionsCheck2.rows[0].count) +
                parseInt(positionsCheck3.rows[0].count);

            if (totalPositions > 0) {
                return res.status(400).json({ error: 'Нельзя удалить товар, который используется в заявках, закупках или ассортименте поставщиков' });
            }

            // Delete product
            await query('DELETE FROM "Товары" WHERE id = $1', [id]);

            res.status(200).json({ message: 'Товар успешно удален' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({
                error: 'Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}