import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

const EFFECTS = new Set(['allow', 'deny']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const r = await query(
                `SELECT up.user_id, up.permission_id, up.effect
                 FROM public.user_permissions up
                 ORDER BY up.user_id ASC, up.permission_id ASC`,
                []
            );
            return res.status(200).json({ items: r.rows || [] });
        }

        if (req.method === 'PUT') {
            const body = req.body || {};
            const userId = Number(body.userId);
            const permissionId = Number(body.permissionId);
            const effect = typeof body.effect === 'string' ? body.effect : '';

            if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' });
            if (!Number.isInteger(permissionId) || permissionId <= 0) return res.status(400).json({ error: 'permissionId обязателен' });
            if (!EFFECTS.has(effect)) return res.status(400).json({ error: 'effect должен быть allow или deny' });

            await query(
                `INSERT INTO public.user_permissions(user_id, permission_id, effect)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, permission_id) DO UPDATE SET effect = EXCLUDED.effect`,
                [userId, permissionId, effect]
            );

            return res.status(200).json({ ok: true });
        }

        if (req.method === 'DELETE') {
            const userId = Number(Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId);
            const permissionId = Number(Array.isArray(req.query.permissionId) ? req.query.permissionId[0] : req.query.permissionId);
            if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' });
            if (!Number.isInteger(permissionId) || permissionId <= 0) return res.status(400).json({ error: 'permissionId обязателен' });

            await query(
                `DELETE FROM public.user_permissions
                 WHERE user_id = $1 AND permission_id = $2`,
                [userId, permissionId]
            );

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
