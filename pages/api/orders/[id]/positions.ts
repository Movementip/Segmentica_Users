import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import { requirePermission } from '../../../../lib/auth';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption, isValidVatRateId, normalizeVatRateId } from '../../../../lib/vat';
import { checkAndCreateMissingProducts } from '../../../../lib/missingProductsHelper';

export interface OrderPosition {
    id: number;
    заявка_id: number;
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id: number | null;
    // Additional info from joins
    товар_название?: string;
    товар_артикул?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<OrderPosition[] | { error: string } | { message: string }>
) {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID заявки обязателен' });
    }

    if (req.method === 'GET') {
        try {
            const result = await query(`
        SELECT 
          pz.*,
          t."название" as товар_название,
          t."артикул" as товар_артикул
        FROM "Позиции_заявки" pz
        LEFT JOIN "Товары" t ON pz."товар_id" = t.id
        WHERE pz."заявка_id" = $1
        ORDER BY pz.id
      `, [id]);

            const positions: OrderPosition[] = result.rows.map((row: any) => ({
                id: row.id,
                заявка_id: row.заявка_id,
                товар_id: row.товар_id,
                количество: parseInt(row.количество) || 0,
                цена: parseFloat(row.цена) || 0,
                ндс_id: row.ндс_id == null ? null : Number(row.ндс_id),
                товар_название: row.товар_название,
                товар_артикул: row.товар_артикул
            }));

            res.status(200).json(positions);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения позиций заявки: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'orders.edit');
        if (!actor) return;
        try {
            const { товар_id, количество, цена, ндс_id } = req.body;

            if (!товар_id || !количество || !цена) {
                return res.status(400).json({ error: 'Товар, количество и цена обязательны' });
            }

            if (!isValidVatRateId(ндс_id ?? DEFAULT_VAT_RATE_ID)) {
                return res.status(400).json({ error: 'Некорректная ставка НДС' });
            }

            const result = await query(`
        INSERT INTO "Позиции_заявки" (
          "заявка_id", 
          "товар_id", 
          "количество", 
          "цена",
          "ндс_id"
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [id, товар_id, количество, цена, normalizeVatRateId(ндс_id)]);

            // Update order total
            await updateOrderTotal(id);
            await checkAndCreateMissingProducts(Number(id));

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error adding position:', error);
            res.status(500).json({ error: 'Failed to add position' });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'orders.edit');
        if (!actor) return;
        try {
            const { positionId } = req.body;

            if (!positionId) {
                return res.status(400).json({ error: 'ID позиции обязателен' });
            }

            const result = await query(
                'DELETE FROM "Позиции_заявки" WHERE id = $1 AND "заявка_id" = $2 RETURNING *',
                [positionId, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Позиция не найдена' });
            }

            // Update order total
            await updateOrderTotal(id);
            await checkAndCreateMissingProducts(Number(id));

            res.status(200).json({ message: 'Позиция успешно удалена' });
        } catch (error) {
            console.error('Error deleting position:', error);
            res.status(500).json({ error: 'Failed to delete position' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}

// Helper function to update order total
async function updateOrderTotal(orderId: string) {
    try {
        const result = await query(`
      SELECT "количество", "цена", COALESCE("ндс_id", 5) as "ндс_id"
      FROM "Позиции_заявки"
      WHERE "заявка_id" = $1
    `, [orderId]);

        const total = result.rows.reduce((sum: number, row: any) => {
            const vatRate = getVatRateOption(row.ндс_id).rate;
            return sum + calculateVatAmountsFromLine(Number(row.количество), Number(row.цена), vatRate).total;
        }, 0);

        await query(`
      UPDATE "Заявки" 
      SET "общая_сумма" = $1
      WHERE id = $2
    `, [total, orderId]);
    } catch (error) {
        console.error('Error updating order total:', error);
    }
}
