import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

const getAttachmentPermissionKey = (
    entityType: string,
    action: 'view' | 'upload' | 'delete',
    opts?: { scope?: string | null }
) => {
    const t = String(entityType || '').trim().toLowerCase();
    const scope = String(opts?.scope || '').trim().toLowerCase();

    if (t === 'product' && scope === 'warehouse') {
        return `warehouse-products.attachments.${action}`;
    }

    const prefix =
        t === 'order'
            ? 'orders'
            : t === 'product'
                ? 'products'
                : t === 'client'
                    ? 'clients'
                    : t === 'purchase'
                        ? 'purchases'
                        : t === 'shipment'
                            ? 'shipments'
                            : t === 'supplier'
                                ? 'suppliers'
                                : t === 'transport'
                                    ? 'transport'
                                    : t === 'manager'
                                        ? 'managers'
                                        : null;

    if (!prefix) return null;

    if (action === 'view') return `${prefix}.attachments.view`;
    if (action === 'upload') return `${prefix}.attachments.upload`;
    return `${prefix}.attachments.delete`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    try {
        const { id, entity_type, entity_id, perm_scope } = req.query;
        const attachmentId = Array.isArray(id) ? id[0] : id;
        const entityType = Array.isArray(entity_type) ? entity_type[0] : entity_type;
        const entityIdRaw = Array.isArray(entity_id) ? entity_id[0] : entity_id;
        const permScope = Array.isArray(perm_scope) ? perm_scope[0] : perm_scope;

        if (!attachmentId) {
            return res.status(400).json({ error: 'ID вложения обязателен' });
        }

        if (!entityType || !entityIdRaw) {
            return res.status(400).json({ error: 'entity_type и entity_id обязательны' });
        }

        const perm = getAttachmentPermissionKey(entityType, 'delete', { scope: permScope });
        if (!perm) {
            return res.status(400).json({ error: 'Некорректный entity_type' });
        }

        const actor = await requirePermission(req, res, perm);
        if (!actor) return;

        const entityId = Number(entityIdRaw);
        if (!Number.isInteger(entityId) || entityId <= 0) {
            return res.status(400).json({ error: 'Некорректный entity_id' });
        }

        const pool = await getPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `
                DELETE FROM public.attachment_links
                WHERE entity_type = $1 AND entity_id = $2 AND attachment_id = $3
                `,
                [entityType, entityId, attachmentId]
            );

            const linksLeft = await client.query(
                `
                SELECT COUNT(*)::int AS cnt
                FROM public.attachment_links
                WHERE attachment_id = $1
                `,
                [attachmentId]
            );

            const cnt = linksLeft.rows?.[0]?.cnt ?? 0;
            if (cnt === 0) {
                await client.query('DELETE FROM public.attachments WHERE id = $1', [attachmentId]);
            }

            await client.query('COMMIT');
            return res.status(200).json({ message: 'OK' });
        } catch (txError) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error rolling back attachment delete transaction:', rollbackError);
            }
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting attachment:', error);
        return res.status(500).json({ error: 'Ошибка удаления вложения' });
    }
}
