import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const r = await query(
            `SELECT
                u.id as user_id,
                u.employee_id,
                u.is_active,
                COALESCE(e."фио", '') as fio,
                e."должность" as position
             FROM public.users u
             LEFT JOIN public."Сотрудники" e ON e.id = u.employee_id
             ORDER BY u.id ASC`,
            []
        );

        return res.status(200).json({ items: r.rows || [] });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
