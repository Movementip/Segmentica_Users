import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true } | { error: string }>) {
    try {
        const actor = await requireAuth(req, res);
        if (!actor) return;

        if (req.method !== 'PUT') {
            res.setHeader('Allow', ['PUT']);
            return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        }

        const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        if (!password) {
            return res.status(400).json({ error: 'Введите новый пароль' });
        }

        const currentUserRes = await query(
            `
            SELECT id, (password_hash = crypt($2, password_hash)) AS is_same_password
            FROM public.users
            WHERE id = $1
            LIMIT 1
            `,
            [actor.userId, password]
        );

        const currentUser = currentUserRes.rows?.[0];
        if (!currentUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (Boolean(currentUser.is_same_password)) {
            return res.status(400).json({ error: 'Новый пароль не должен совпадать с текущим' });
        }

        await query(
            `
            UPDATE public.users
            SET password_hash = crypt($2, gen_salt('bf'))
            WHERE id = $1
            `,
            [actor.userId, password]
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Profile password API error:', error);
        return res.status(500).json({ error: 'Ошибка смены пароля' });
    }
}
