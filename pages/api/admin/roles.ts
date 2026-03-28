import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

const getTableColumns = async (tableName: string): Promise<Set<string>> => {
    const colsRes = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );
    return new Set((colsRes.rows || []).map((r: any) => String(r.column_name)));
};

const pickCol = (cols: Set<string>, preferred: string[]): string | null => {
    for (const c of preferred) {
        if (cols.has(c)) return c;
    }
    return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const user = await requireDirector(req, res);
        if (!user) return;

        const cols = await getTableColumns('roles');
        const idCol = pickCol(cols, ['id']);
        const keyCol = pickCol(cols, ['key', 'role_key']);
        const nameCol = pickCol(cols, ['name', 'title']);
        const descCol = pickCol(cols, ['description', 'desc']);

        if (!idCol || !keyCol) {
            return res.status(500).json({ error: 'RBAC: таблица roles не содержит обязательные колонки' });
        }

        if (req.method === 'GET') {
            const selectCols: string[] = [`${idCol} as id`, `${keyCol} as key`];
            if (nameCol) selectCols.push(`${nameCol} as name`);
            if (descCol) selectCols.push(`${descCol} as description`);

            const r = await query(
                `SELECT ${selectCols.join(', ')}
                 FROM public.roles
                 ORDER BY ${idCol} ASC`,
                []
            );
            return res.status(200).json({ items: r.rows || [] });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const key = typeof body.key === 'string' ? body.key.trim() : '';
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            const description = typeof body.description === 'string' ? body.description.trim() : '';

            if (!key) return res.status(400).json({ error: 'key обязателен' });

            const colsToInsert: string[] = [keyCol];
            const params: any[] = [key];
            if (nameCol && name) {
                colsToInsert.push(nameCol);
                params.push(name);
            }
            if (descCol && description) {
                colsToInsert.push(descCol);
                params.push(description);
            }

            const valuesSql = colsToInsert.map((_, i) => `$${i + 1}`).join(', ');
            const retCols: string[] = [`${idCol} as id`, `${keyCol} as key`];
            if (nameCol) retCols.push(`${nameCol} as name`);
            if (descCol) retCols.push(`${descCol} as description`);

            const r = await query(
                `INSERT INTO public.roles(${colsToInsert.join(', ')})
                 VALUES (${valuesSql})
                 RETURNING ${retCols.join(', ')}`,
                params
            );

            return res.status(200).json({ item: r.rows?.[0] || null });
        }

        if (req.method === 'PUT') {
            const body = req.body || {};
            const id = Number(body.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id обязателен' });

            const key = typeof body.key === 'string' ? body.key.trim() : null;
            const name = typeof body.name === 'string' ? body.name.trim() : null;
            const description = typeof body.description === 'string' ? body.description.trim() : null;

            const sets: string[] = [];
            const params: any[] = [];

            if (key !== null && key !== '') {
                sets.push(`${keyCol} = $${params.length + 1}`);
                params.push(key);
            }
            if (nameCol && name !== null) {
                sets.push(`${nameCol} = $${params.length + 1}`);
                params.push(name === '' ? null : name);
            }
            if (descCol && description !== null) {
                sets.push(`${descCol} = $${params.length + 1}`);
                params.push(description === '' ? null : description);
            }

            if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });

            params.push(id);

            const retCols: string[] = [`${idCol} as id`, `${keyCol} as key`];
            if (nameCol) retCols.push(`${nameCol} as name`);
            if (descCol) retCols.push(`${descCol} as description`);

            const r = await query(
                `UPDATE public.roles
                 SET ${sets.join(', ')}
                 WHERE ${idCol} = $${params.length}
                 RETURNING ${retCols.join(', ')}`,
                params
            );
            return res.status(200).json({ item: r.rows?.[0] || null });
        }

        if (req.method === 'DELETE') {
            const idRaw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
            const id = Number(idRaw);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id обязателен' });

            await query(`DELETE FROM public.roles WHERE ${idCol} = $1`, [id]);
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка' });
    }
}
