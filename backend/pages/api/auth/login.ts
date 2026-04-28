import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureLocalPgCrypto, queryLocalNoAudit } from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';
import { enterRequestContext } from '../../../lib/requestContext';

const parsePositiveHours = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getSessionExpiration = (now: Date, rememberMe: boolean): Date => {
    const sessionHours = parsePositiveHours(process.env.AUTH_SESSION_HOURS, 12);
    const rememberHours = parsePositiveHours(process.env.AUTH_REMEMBER_ME_HOURS, 24);
    const hours = rememberMe ? rememberHours : sessionHours;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    enterRequestContext(req, null);

    const { employee_id, password, rememberMe, theme } = req.body || {};
    const employeeId = Number(employee_id);
    const pwd = typeof password === 'string' ? password : '';
    const rem = Boolean(rememberMe);
    const nextTheme = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : null;

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({ error: 'Некорректный сотрудник' });
    }
    if (!pwd) {
        return res.status(400).json({ error: 'Введите пароль' });
    }

    try {
        const userRes = await queryLocalNoAudit(
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

        await ensureLocalPgCrypto();

        const verifyRes = await queryLocalNoAudit(
            `SELECT (password_hash = crypt($1, password_hash)) AS ok
             FROM public.users
             WHERE id = $2`,
            [pwd, userRow.id]
        );

        const ok = Boolean(verifyRes.rows?.[0]?.ok);
        if (!ok) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        if (nextTheme) {
            await queryLocalNoAudit(
                `UPDATE public.users
                 SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb
                 WHERE id = $1`,
                [userRow.id, JSON.stringify({ theme: nextTheme })]
            );
        }

        const now = new Date();
        const expiresAt = getSessionExpiration(now, rem);

        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 200);
        const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);

        const sessionRes = await queryLocalNoAudit(
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
