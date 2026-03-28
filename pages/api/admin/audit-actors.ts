import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const limitRaw = Number(typeof req.query.limit === 'string' ? req.query.limit : 10) || 10;
        const limit = Math.min(50, Math.max(1, limitRaw));

        const colsRes = await query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
            []
        );
        const cols = new Set((colsRes.rows || []).map((r: any) => String(r.column_name)));
        const actorCol = cols.has('actor_user_id') ? 'actor_user_id' : cols.has('user_id') ? 'user_id' : null;

        const params: any[] = [];
        const where: string[] = [`COALESCE(e."фио", '') <> ''`];

        if (q) {
            params.push(`%${q}%`);
            where.push(`LOWER(COALESCE(e."фио", '')) LIKE LOWER($${params.length})`);
        }

        params.push(limit);

        const joinActor = actorCol
            ? `LEFT JOIN public.users u ON u.id = a.${actorCol}
               LEFT JOIN public."Сотрудники" e ON e.id = u.employee_id`
            : `LEFT JOIN public."Сотрудники" e ON 1 = 0`;

        const sql = `SELECT DISTINCT e."фио" as fio
                     FROM public.audit_logs a
                     ${joinActor}
                     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                     ORDER BY e."фио" ASC
                     LIMIT $${params.length}`;

        const r = await query(sql, params);
        const items = (r.rows || []).map((row: any) => String(row.fio)).filter(Boolean);
        return res.status(200).json({ items });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
