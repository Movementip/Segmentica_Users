import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    // If q is empty, return a small list for the dropdown on focus
    const isEmpty = q.length < 1;

    try {
        // NOTE: Postgres case-insensitive matching for Cyrillic depends on DB collation.
        // To be reliable, we filter case-insensitively in JS after fetching a capped set.
        const raw = await query(
            `SELECT id, "фио" as fio, "должность" as position
             FROM public."Сотрудники"
             ORDER BY id DESC
             LIMIT ${isEmpty ? 20 : 200}`,
            []
        );

        const needle = q.toLowerCase();
        const filtered = isEmpty
            ? raw.rows || []
            : (raw.rows || []).filter((r: any) => String(r.fio || '').toLowerCase().includes(needle));

        const rows = filtered.slice(0, 20);

        return res.status(200).json(
            rows.map((r: any) => ({
                id: Number(r.id),
                fio: String(r.fio),
                position: r.position == null ? null : String(r.position),
            }))
        );
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
