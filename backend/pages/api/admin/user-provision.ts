import type { NextApiRequest, NextApiResponse } from 'next';
import { ensurePgCrypto, query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

const generatePassword = (len = 10): string => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const r = await query(
                `SELECT e.id, e."фио" as fio, e."должность" as position
                 FROM public."Сотрудники" e
                 LEFT JOIN public.users u ON u.employee_id = e.id
                 WHERE u.id IS NULL
                 ORDER BY e.id ASC`,
                []
            );

            return res.status(200).json({ items: r.rows || [] });
        }

        if (req.method === 'POST') {
            await ensurePgCrypto();

            const { employeeId, password } = req.body || {};
            const empId = Number(employeeId);
            const pwd = typeof password === 'string' ? password.trim() : '';
            if (!Number.isInteger(empId) || empId <= 0) {
                return res.status(400).json({ error: 'Некорректный сотрудник' });
            }

            const eRes = await query(`SELECT id FROM public."Сотрудники" WHERE id = $1 LIMIT 1`, [empId]);
            if (!eRes.rows?.[0]) {
                return res.status(400).json({ error: 'Сотрудник не найден' });
            }

            const existing = await query(`SELECT id FROM public.users WHERE employee_id = $1 LIMIT 1`, [empId]);
            if (existing.rows?.[0]) {
                return res.status(409).json({ error: 'У сотрудника уже есть пользователь' });
            }

            const finalPwd = pwd || generatePassword(10);
            const ins = await query(
                `INSERT INTO public.users(employee_id, password_hash, is_active)
                 VALUES ($1, crypt($2, gen_salt('bf')), true)
                 RETURNING id`,
                [empId, finalPwd]
            );

            const userId = Number(ins.rows?.[0]?.id);
            if (!Number.isInteger(userId) || userId <= 0) {
                return res.status(500).json({ error: 'Не удалось создать пользователя' });
            }

            return res.status(200).json({ ok: true, userId, password: finalPwd });
        }

        if (req.method === 'PUT') {
            await ensurePgCrypto();

            const { userId, password } = req.body || {};
            const uid = Number(userId);
            const pwd = typeof password === 'string' ? password.trim() : '';
            if (!Number.isInteger(uid) || uid <= 0) {
                return res.status(400).json({ error: 'Некорректный пользователь' });
            }

            if (!pwd) {
                return res.status(400).json({ error: 'Введите новый пароль' });
            }

            const currentUserRes = await query(
                `SELECT id, (password_hash = crypt($2, password_hash)) AS is_same_password
                 FROM public.users
                 WHERE id = $1
                 LIMIT 1`,
                [uid, pwd]
            );

            const currentUser = currentUserRes.rows?.[0];
            if (!currentUser) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            if (Boolean(currentUser.is_same_password)) {
                return res.status(400).json({ error: 'Новый пароль не должен совпадать с текущим' });
            }

            const upd = await query(
                `UPDATE public.users
                 SET password_hash = crypt($2, gen_salt('bf'))
                 WHERE id = $1
                 RETURNING id`,
                [uid, pwd]
            );

            const updatedId = Number(upd.rows?.[0]?.id);
            if (!Number.isInteger(updatedId) || updatedId <= 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            return res.status(200).json({ ok: true, userId: updatedId, password: pwd });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
