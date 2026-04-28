import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { queryLocalNoAudit } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const theme = req.body?.theme === 'dark' ? 'dark' : req.body?.theme === 'light' ? 'light' : null;
        const patch = req.body?.patch && typeof req.body.patch === 'object' && !Array.isArray(req.body.patch)
            ? req.body.patch as Record<string, unknown>
            : null;

        const nextPreferences = {
            ...(theme ? { theme } : {}),
            ...(patch || {}),
        };

        if (Object.keys(nextPreferences).length === 0) {
            return res.status(400).json({ error: 'Некорректные настройки' });
        }

        await queryLocalNoAudit(
            `UPDATE public.users
             SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb
             WHERE id = $1`,
            [user.userId, JSON.stringify(nextPreferences)]
        );

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
