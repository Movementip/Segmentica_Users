import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

type ImportRow = {
    заявка_id: number;
    транспорт_id: number;
    статус?: string | null;
    номер_отслеживания?: string | null;
    дата_отгрузки?: string | null;
    стоимость_доставки?: number | null;
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

    const actor = await requirePermission(req, res, 'shipments.import.excel');
    if (!actor) return;

    const actor1 = await requirePermission(req, res, 'shipments.delete');
    if (!actor1) return;

    const actor2 = await requirePermission(req, res, 'shipments.create');
    if (!actor2) return;

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

            const ordersRes = await client.query('SELECT id FROM "Заявки"');
            const orderIds = new Set<number>((ordersRes.rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n)));

            const transportsRes = await client.query('SELECT id FROM "Транспортные_компании"');
            const transportIds = new Set<number>((transportsRes.rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n)));

            const errors: Array<{ index: number; error: string }> = [];

            for (let i = 0; i < rows.length; i++) {
                const raw = rows[i] as ImportRow;
                const orderId = toNumberOrNull((raw as any)?.заявка_id);
                const transportId = toNumberOrNull((raw as any)?.транспорт_id);

                if (!orderId || orderId <= 0) {
                    errors.push({ index: i, error: 'заявка_id обязателен' });
                    continue;
                }

                if (!transportId || transportId <= 0) {
                    errors.push({ index: i, error: 'транспорт_id обязателен' });
                    continue;
                }

                if (!orderIds.has(orderId)) {
                    errors.push({ index: i, error: `заявка_id=${orderId} не найдена` });
                    continue;
                }

                if (!transportIds.has(transportId)) {
                    errors.push({ index: i, error: `транспорт_id=${transportId} не найден` });
                    continue;
                }

                const status = toStringOrNull((raw as any)?.статус) || 'в пути';
                const track = toStringOrNull((raw as any)?.номер_отслеживания);
                const shippedAt = toStringOrNull((raw as any)?.дата_отгрузки);
                const cost = toNumberOrNull((raw as any)?.стоимость_доставки);

                void status;
                void track;
                void shippedAt;
                void cost;
            }

            if (errors.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Импорт содержит ошибки', details: errors.slice(0, 50) });
            }

            await client.query('TRUNCATE TABLE "Отгрузки" RESTART IDENTITY CASCADE');

            // Insert in reverse order to preserve visible ordering when list API sorts by date DESC.
            for (let i = rows.length - 1; i >= 0; i--) {
                const raw = rows[i] as ImportRow;

                const orderId = Number(raw.заявка_id);
                const transportId = Number(raw.транспорт_id);
                const status = toStringOrNull((raw as any)?.статус) || 'в пути';
                const track = toStringOrNull((raw as any)?.номер_отслеживания);
                const shippedAt = toStringOrNull((raw as any)?.дата_отгрузки);
                const cost = toNumberOrNull((raw as any)?.стоимость_доставки);

                if (shippedAt) {
                    await client.query(
                        `INSERT INTO "Отгрузки" (
                            "заявка_id",
                            "транспорт_id",
                            "статус",
                            "номер_отслеживания",
                            "дата_отгрузки",
                            "стоимость_доставки"
                        ) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [orderId, transportId, status, track, shippedAt, cost]
                    );
                } else {
                    await client.query(
                        `INSERT INTO "Отгрузки" (
                            "заявка_id",
                            "транспорт_id",
                            "статус",
                            "номер_отслеживания",
                            "стоимость_доставки"
                        ) VALUES ($1, $2, $3, $4, $5)`,
                        [orderId, transportId, status, track, cost]
                    );
                }
            }

            await client.query('COMMIT');

            return res.status(200).json({ message: 'Импорт выполнен', inserted: rows.length, mode: 'replace_all' });
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
        console.error('Shipments import error:', error);
        return res.status(500).json({ error: 'Ошибка импорта отгрузок' });
    }
}
