import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

type ImportRow = {
    артикул: string;
    название?: string;
    категория?: string | null;
    единица_измерения?: string;
    минимальный_остаток?: number;
    цена_закупки?: number;
    цена_продажи?: number;
};

const toNumberOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const s = String(v).replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const toStringOrNull = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const actor = await requirePermission(req, res, 'products.import');
    if (!actor) return;

    try {
        const { rows } = req.body as { rows?: ImportRow[] };
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'rows обязателен' });
        }

        if (rows.length > 5000) {
            return res.status(400).json({ error: 'Слишком много строк для импорта (макс. 5000)' });
        }

        const pool = await getPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const categoriesRes = await client.query('SELECT id, "название" FROM "Категории_товаров"');
            const categoryIdByName = new Map<string, number>();
            for (const r of categoriesRes.rows || []) {
                if (r?.название) categoryIdByName.set(String(r.название).trim(), Number(r.id));
            }

            let createdProducts = 0;
            let updatedProducts = 0;
            let priceHistoryInserted = 0;
            const errors: Array<{ index: number; error: string }> = [];

            for (let i = 0; i < rows.length; i++) {
                const raw = rows[i] as ImportRow;

                const артикул = toStringOrNull(raw?.артикул);
                const название = toStringOrNull(raw?.название);
                const единица = toStringOrNull(raw?.единица_измерения) || 'шт';

                const minN = toNumberOrNull(raw?.минимальный_остаток);
                const buyN = toNumberOrNull(raw?.цена_закупки);
                const sellN = toNumberOrNull(raw?.цена_продажи);

                if (!артикул) {
                    errors.push({ index: i, error: 'артикул обязателен' });
                    continue;
                }

                if (!название) {
                    errors.push({ index: i, error: 'название обязательно' });
                    continue;
                }

                const catName = toStringOrNull(raw?.категория);
                const categoryId = (catName && categoryIdByName.get(catName)) || 1;

                const existing = await client.query(
                    'SELECT id, "цена_закупки", "цена_продажи" FROM "Товары" WHERE "артикул" = $1 LIMIT 1',
                    [артикул]
                );

                let productId: number;
                let created = false;
                let prevBuy: number | null = null;
                let prevSell: number | null = null;

                if (existing.rows.length > 0) {
                    productId = Number(existing.rows[0].id);
                    prevBuy = existing.rows[0].цена_закупки != null ? Number(existing.rows[0].цена_закупки) : null;
                    prevSell = existing.rows[0].цена_продажи != null ? Number(existing.rows[0].цена_продажи) : null;

                    await client.query(
                        `UPDATE "Товары"
                         SET "название" = $1,
                             "категория_id" = $2,
                             "единица_измерения" = $3,
                             "минимальный_остаток" = $4,
                             "цена_закупки" = $5,
                             "цена_продажи" = $6
                         WHERE id = $7`,
                        [
                            название,
                            categoryId,
                            единица,
                            minN ?? 0,
                            buyN ?? 0,
                            sellN ?? 0,
                            productId,
                        ]
                    );
                    updatedProducts++;
                } else {
                    const ins = await client.query(
                        `INSERT INTO "Товары" ("название", "артикул", "категория_id", "единица_измерения", "минимальный_остаток", "цена_закупки", "цена_продажи")
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING id`,
                        [
                            название,
                            артикул,
                            categoryId,
                            единица,
                            minN ?? 0,
                            buyN ?? 0,
                            sellN ?? 0,
                        ]
                    );
                    productId = Number(ins.rows[0].id);
                    createdProducts++;
                    created = true;
                }

                const nextBuy = buyN ?? 0;
                const nextSell = sellN ?? 0;

                const priceChanged = created || prevBuy !== nextBuy || prevSell !== nextSell;
                if (priceChanged) {
                    await client.query(
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
                        [
                            productId,
                            nextBuy,
                            nextSell,
                            created ? 'excel_import_create' : 'excel_import_update',
                            'Импорт из Excel',
                        ]
                    );
                    priceHistoryInserted++;
                }
            }

            if (errors.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'Импорт содержит ошибки',
                    details: errors.slice(0, 50),
                });
            }

            await client.query('COMMIT');

            return res.status(200).json({
                message: 'Импорт выполнен',
                createdProducts,
                updatedProducts,
                priceHistoryInserted,
            });
        } catch (e) {
            try {
                await client.query('ROLLBACK');
            } catch {
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Products import error:', error);
        return res.status(500).json({ error: 'Ошибка импорта товаров' });
    }
}
