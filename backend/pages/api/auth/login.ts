import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';

const getNextMondayExpiration = (now: Date): Date => {
    const next = new Date(now);
    next.setHours(0, 0, 0, 0);
    const currentWeekday = next.getDay(); // 0 Sunday ... 6 Saturday
    const daysUntilNextMonday = currentWeekday === 1 ? 7 : ((8 - currentWeekday) % 7 || 7);
    next.setDate(next.getDate() + daysUntilNextMonday);
    return next;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { employee_id, password, rememberMe } = req.body || {};
    const employeeId = Number(employee_id);
    const pwd = typeof password === 'string' ? password : '';
    const rem = Boolean(rememberMe);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({ error: 'Некорректный сотрудник' });
    }
    if (!pwd) {
        return res.status(400).json({ error: 'Введите пароль' });
    }

    try {
        const userRes = await query(
            `SELECT id, password_hash, is_active
             FROM public.users
             WHERE employee_id = $1
             LIMIT 1`,
            [employeeId]
        );

        const userRow = userRes.rows?.[0];
        if (!userRow) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        if (userRow.is_active === false) {
            return res.status(403).json({ error: 'Пользователь отключен' });
        }

        const verifyRes = await query(
            `SELECT (password_hash = crypt($1, password_hash)) AS ok
             FROM public.users
             WHERE id = $2`,
            [pwd, userRow.id]
        );

        const ok = Boolean(verifyRes.rows?.[0]?.ok);
        if (!ok) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const now = new Date();
        const expiresAt = rem
            ? getNextMondayExpiration(now)
            : new Date(now.getTime() + 12 * 60 * 60 * 1000);

        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 200);
        const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);

        const sessionRes = await query(
            `INSERT INTO public.sessions(user_id, expires_at, ip, user_agent)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [userRow.id, expiresAt.toISOString(), ip, userAgent]
        );

        const sessionId = String(sessionRes.rows?.[0]?.id);
        if (!sessionId) {
            return res.status(500).json({ error: 'Не удалось создать сессию' });
        }

        setSessionCookie(res, sessionId, { expiresAt });
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка входа' });
    }
}
