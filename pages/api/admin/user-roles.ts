import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const r = await query(
                `SELECT ur.user_id, ur.role_id
                 FROM public.user_roles ur
                 ORDER BY ur.user_id ASC, ur.role_id ASC`,
                []
            );
            return res.status(200).json({ items: r.rows || [] });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const userId = Number(body.userId);
            const roleId = Number(body.roleId);
            if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' });
            if (!Number.isInteger(roleId) || roleId <= 0) return res.status(400).json({ error: 'roleId обязателен' });

            await query(
                `INSERT INTO public.user_roles(user_id, role_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [userId, roleId]
            );
            return res.status(200).json({ ok: true });
        }

        if (req.method === 'DELETE') {
            const userId = Number(Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId);
            const roleId = Number(Array.isArray(req.query.roleId) ? req.query.roleId[0] : req.query.roleId);
            if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' });
            if (!Number.isInteger(roleId) || roleId <= 0) return res.status(400).json({ error: 'roleId обязателен' });

            await query(
                `DELETE FROM public.user_roles
                 WHERE user_id = $1 AND role_id = $2`,
                [userId, roleId]
            );
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
