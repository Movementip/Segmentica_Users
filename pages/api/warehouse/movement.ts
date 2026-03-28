import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

type MovementType = 'приход' | 'расход';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { operation_kind, товар_id, тип_операции, количество, комментарий } = req.body as {
            operation_kind?: 'movement' | 'adjustment';
            товар_id?: number;
            тип_операции?: MovementType;
            количество?: number;
            комментарий?: string | null;
        };

        const kind: 'movement' | 'adjustment' = operation_kind === 'adjustment' ? 'adjustment' : 'movement';
        const requiredPermission = kind === 'adjustment' ? 'warehouse.stock.adjust' : 'warehouse.movement.create';
        const actor = await requirePermission(req, res, requiredPermission);
        if (!actor) return;

        const productId = Number(товар_id);
        const qty = Number(количество);
        const type = тип_операции;

        if (!productId || !Number.isFinite(productId)) {
            return res.status(400).json({ error: 'товар_id обязателен' });
        }

        if (type !== 'приход' && type !== 'расход') {
            return res.status(400).json({ error: 'тип_операции должен быть "приход" или "расход"' });
        }

        if (!Number.isFinite(qty) || qty <= 0) {
            return res.status(400).json({ error: 'количество должно быть больше 0' });
        }

        await query('BEGIN');
        try {
            const stockRes = await query('SELECT id, "количество" FROM "Склад" WHERE "товар_id" = $1 FOR UPDATE', [productId]);
            if (stockRes.rows.length === 0) {
                await query('ROLLBACK');
                return res.status(404).json({ error: 'Товар не найден на складе' });
            }

            const stockRow = stockRes.rows[0];
            const currentQty = Number(stockRow.количество) || 0;
            const delta = type === 'приход' ? qty : -qty;
            const nextQty = currentQty + delta;

            if (nextQty < 0) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'Недостаточно товара на складе для расхода' });
            }

            await query('UPDATE "Склад" SET "количество" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE id = $2', [nextQty, stockRow.id]);

            await query(
                'INSERT INTO "Движения_склада" ("товар_id", "тип_операции", "количество", "дата_операции", "комментарий") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)',
                [productId, type, qty, комментарий || null]
            );

            await query('COMMIT');

            return res.status(201).json({ message: 'Движение сохранено', nextQty });
        } catch (e) {
            await query('ROLLBACK');
            throw e;
        }
    } catch (error) {
        console.error('Error creating warehouse movement:', error);
        return res.status(500).json({ error: 'Ошибка создания движения склада' });
    }
}
