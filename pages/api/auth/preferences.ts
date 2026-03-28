import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const theme = req.body?.theme === 'dark' ? 'dark' : req.body?.theme === 'light' ? 'light' : null;
        if (!theme) return res.status(400).json({ error: 'Некорректная тема' });

        await query(
            `UPDATE public.users
             SET preferences = jsonb_set(COALESCE(preferences, '{}'::jsonb), '{theme}', to_jsonb($2::text), true)
             WHERE id = $1`,
            [user.userId, theme]
        );

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
