import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        const colsRes = await query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'audit_logs'`,
            []
        );
        const cols = new Set((colsRes.rows || []).map((r: any) => String(r.column_name)));

        const actorCol = cols.has('actor_user_id') ? 'actor_user_id' : cols.has('user_id') ? 'user_id' : null;
        const hasCreatedAt = cols.has('created_at') ? 'created_at' : cols.has('created') ? 'created' : null;

        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const method = typeof req.query.method === 'string' ? req.query.method.trim().toUpperCase() : 'ALL';
        const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type.trim() : '';
        const actor = typeof req.query.actor === 'string' ? req.query.actor.trim() : '';
        const page = Math.max(1, Number(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page) || 1);
        const limitRaw = Number(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) || 50;
        const limit = Math.min(200, Math.max(10, limitRaw));
        const offset = (page - 1) * limit;

        const where: string[] = [];
        const params: any[] = [];

        const textCols: string[] = [];
        if (cols.has('action')) textCols.push('a.action');
        if (cols.has('event')) textCols.push('a.event');
        if (cols.has('entity_type')) textCols.push('a.entity_type');
        if (cols.has('entity')) textCols.push('a.entity');
        if (cols.has('ip')) textCols.push('a.ip');
        if (cols.has('user_agent')) textCols.push('a.user_agent');

        const hasEntityId = cols.has('entity_id');
        const hasTargetId = cols.has('target_id');

        if (q) {
            const ors: string[] = [];
            params.push(`%${q}%`);
            const p = `$${params.length}`;
            for (const c of textCols) {
                ors.push(`${c} ILIKE ${p}`);
            }

            if (hasEntityId) ors.push(`CAST(a.entity_id AS text) ILIKE ${p}`);
            if (hasTargetId) ors.push(`CAST(a.target_id AS text) ILIKE ${p}`);

            // actor fio search
            ors.push(
                `translate(COALESCE(e."фио", ''), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя') LIKE ` +
                `translate(${p}, 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя')`
            );

            if (ors.length) where.push(`(${ors.join(' OR ')})`);
        }

        if (method && method !== 'ALL') {
            // Prefer filtering by action prefix ("PUT /api/..."), fallback to details->>method if present.
            if (cols.has('action')) {
                params.push(`${method} %`);
                where.push(`a.action ILIKE $${params.length}`);
            } else if (cols.has('event')) {
                params.push(`${method} %`);
                where.push(`a.event ILIKE $${params.length}`);
            } else if (cols.has('details')) {
                params.push(method);
                where.push(`(a.details->>'method') ILIKE $${params.length}`);
            }
        }

        if (entityType) {
            if (cols.has('entity_type')) {
                params.push(`%${entityType}%`);
                where.push(`a.entity_type ILIKE $${params.length}`);
            } else if (cols.has('entity')) {
                params.push(`%${entityType}%`);
                where.push(`a.entity ILIKE $${params.length}`);
            }
        }

        if (actor) {
            params.push(`%${actor}%`);
            where.push(
                `translate(COALESCE(e."фио", ''), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя') LIKE ` +
                `translate($${params.length}, 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя')`
            );
        }

        const orderBy: string[] = [];
        if (hasCreatedAt) orderBy.push(`a.${hasCreatedAt} DESC`);
        if (cols.has('id')) orderBy.push('a.id DESC');
        if (orderBy.length === 0) orderBy.push('1 DESC');

        const joinActor = actorCol
            ? `LEFT JOIN public.users u ON u.id = a.${actorCol}
               LEFT JOIN public.\"Сотрудники\" e ON e.id = u.employee_id`
            : `LEFT JOIN public.\"Сотрудники\" e ON 1 = 0`;

        params.push(limit);
        params.push(offset);

        const sql = `SELECT a.*, e.\"фио\" as actor_fio
                     FROM public.audit_logs a
                     ${joinActor}
                     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                     ORDER BY ${orderBy.join(', ')}
                     LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const dataRes = await query(sql, params);

        return res.status(200).json({
            items: dataRes.rows || [],
            page,
            limit,
            columns: Array.from(cols),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
