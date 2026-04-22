import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        // Keep DB in sync with UI invariant: director role always has all permissions.
        // This ensures new permissions (e.g. *.list/*.view) are automatically granted.
        try {
            const directorRoleRes = await query(
                `SELECT id FROM public.roles WHERE key = 'director' LIMIT 1`,
                []
            );
            const directorRoleId = Number(directorRoleRes.rows?.[0]?.id);
            if (Number.isInteger(directorRoleId) && directorRoleId > 0) {
                await query(
                    `INSERT INTO public.role_permissions(role_id, permission_id)
                     SELECT $1, p.id
                     FROM public.permissions p
                     ON CONFLICT DO NOTHING`,
                    [directorRoleId]
                );
            }
        } catch (e) {
            console.error(e);
        }

        if (req.method === 'GET') {
            const r = await query(
                `SELECT rp.role_id, rp.permission_id
                 FROM public.role_permissions rp
                 ORDER BY rp.role_id ASC, rp.permission_id ASC`,
                []
            );
            return res.status(200).json({ items: r.rows || [] });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const roleId = Number(body.roleId);
            const permissionId = Number(body.permissionId);
            if (!Number.isInteger(roleId) || roleId <= 0) return res.status(400).json({ error: 'roleId обязателен' });
            if (!Number.isInteger(permissionId) || permissionId <= 0) return res.status(400).json({ error: 'permissionId обязателен' });

            await query(
                `INSERT INTO public.role_permissions(role_id, permission_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [roleId, permissionId]
            );
            return res.status(200).json({ ok: true });
        }

        if (req.method === 'DELETE') {
            const roleId = Number(Array.isArray(req.query.roleId) ? req.query.roleId[0] : req.query.roleId);
            const permissionId = Number(Array.isArray(req.query.permissionId) ? req.query.permissionId[0] : req.query.permissionId);
            if (!Number.isInteger(roleId) || roleId <= 0) return res.status(400).json({ error: 'roleId обязателен' });
            if (!Number.isInteger(permissionId) || permissionId <= 0) return res.status(400).json({ error: 'permissionId обязателен' });

            await query(
                `DELETE FROM public.role_permissions
                 WHERE role_id = $1 AND permission_id = $2`,
                [roleId, permissionId]
            );
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
