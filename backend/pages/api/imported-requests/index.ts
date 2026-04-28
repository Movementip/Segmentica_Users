import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

const normalizeStatus = (value: unknown): 'open' | 'processed' | 'all' => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === 'processed' || raw === 'all') return raw;
    return 'open';
};

const mapRow = (row: any) => ({
    id: Number(row.id),
    source_system: row.source_system == null ? null : String(row.source_system),
    source_form_id: row.source_form_id == null ? null : Number(row.source_form_id),
    source_form_name: row.source_form_name == null ? null : String(row.source_form_name),
    source_entry_id: row.source_entry_id == null ? null : Number(row.source_entry_id),
    source_entry_name: row.source_entry_name == null ? null : String(row.source_entry_name),
    person_name: row.person_name == null ? null : String(row.person_name),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    product_name: row.product_name == null ? null : String(row.product_name),
    message: row.message == null ? null : String(row.message),
    payload: row.payload || {},
    source_url: row.source_url == null ? null : String(row.source_url),
    source_created_at: row.source_created_at == null ? null : String(row.source_created_at),
    source_updated_at: row.source_updated_at == null ? null : String(row.source_updated_at),
    imported_at: row.imported_at == null ? null : String(row.imported_at),
    last_seen_at: row.last_seen_at == null ? null : String(row.last_seen_at),
    viewed_at: row.viewed_at == null ? null : String(row.viewed_at),
    processed_at: row.processed_at == null ? null : String(row.processed_at),
    notes: row.notes == null ? null : String(row.notes),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    if (req.method === 'GET') {
        const status = normalizeStatus(req.query.status);
        const canUseInOrders = hasPermission(actor, 'orders.bitrix_requests.list');
        const canArchive = hasPermission(actor, 'archive.bitrix_requests.list');

        if (!canUseInOrders && !canArchive) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (status !== 'open' && !canArchive) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const filters: string[] = [];
            if (status === 'open') filters.push('processed_at IS NULL');
            if (status === 'processed') filters.push('processed_at IS NOT NULL');

            const result = await query(
                `
                    SELECT *
                    FROM public.imported_requests
                    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
                    ORDER BY COALESCE(source_created_at, imported_at) DESC, id DESC
                    LIMIT 200
                `
            );

            return res.status(200).json(result.rows.map(mapRow));
        } catch (error) {
            console.error('Error fetching imported requests:', error);
            return res.status(500).json({
                error: 'Ошибка загрузки заявок Битрикс24: ' + (error instanceof Error ? error.message : 'Unknown error'),
            });
        }
    }

    if (req.method === 'PATCH') {
        try {
            const id = Number(req.body?.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ error: 'ID импортированной заявки обязателен' });
            }

            const shouldUpdateViewed = req.body?.viewed !== undefined;
            if (shouldUpdateViewed) {
                if (!hasPermission(actor, 'orders.bitrix_requests.list')) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                const viewed = req.body?.viewed !== false;
                const result = await query(
                    `
                        UPDATE public.imported_requests
                        SET viewed_at = CASE WHEN $2::boolean THEN COALESCE(viewed_at, now()) ELSE NULL END
                        WHERE id = $1
                        RETURNING *
                    `,
                    [id, viewed]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Импортированная заявка не найдена' });
                }

                return res.status(200).json(mapRow(result.rows[0]));
            }

            if (!hasPermission(actor, 'orders.bitrix_requests.process')) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const processed = req.body?.processed !== false;
            const notes = typeof req.body?.notes === 'string' && req.body.notes.trim()
                ? req.body.notes.trim()
                : null;

            const result = await query(
                `
                    UPDATE public.imported_requests
                    SET
                        processed_at = CASE WHEN $2::boolean THEN COALESCE(processed_at, now()) ELSE NULL END,
                        viewed_at = CASE WHEN $2::boolean THEN COALESCE(viewed_at, now()) ELSE viewed_at END,
                        notes = COALESCE($3::text, notes)
                    WHERE id = $1
                    RETURNING *
                `,
                [id, processed, notes]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Импортированная заявка не найдена' });
            }

            return res.status(200).json(mapRow(result.rows[0]));
        } catch (error) {
            console.error('Error updating imported request:', error);
            return res.status(500).json({
                error: 'Ошибка обновления заявки Битрикс24: ' + (error instanceof Error ? error.message : 'Unknown error'),
            });
        }
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
