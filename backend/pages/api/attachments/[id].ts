import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { DOCUMENT_PERMISSIONS, getAttachmentPermissionKey } from '../../../lib/attachmentPermissions';

const ensureEntityExists = async (entityType: string, entityId: number) => {
    switch (String(entityType || '').trim().toLowerCase()) {
        case 'order':
            return await query('SELECT id FROM public."Заявки" WHERE id = $1 LIMIT 1', [entityId]);
        case 'client':
            return await query('SELECT id FROM public."Клиенты" WHERE id = $1 LIMIT 1', [entityId]);
        case 'purchase':
            return await query('SELECT id FROM public."Закупки" WHERE id = $1 LIMIT 1', [entityId]);
        case 'shipment':
            return await query('SELECT id FROM public."Отгрузки" WHERE id = $1 LIMIT 1', [entityId]);
        case 'supplier':
            return await query('SELECT id FROM public."Поставщики" WHERE id = $1 LIMIT 1', [entityId]);
        case 'transport':
            return await query('SELECT id FROM public."Транспортные_компании" WHERE id = $1 LIMIT 1', [entityId]);
        case 'manager':
            return await query('SELECT id FROM public."Сотрудники" WHERE id = $1 LIMIT 1', [entityId]);
        case 'product':
            return await query('SELECT id FROM public."Товары" WHERE id = $1 LIMIT 1', [entityId]);
        default:
            return { rows: [] as any[] };
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PATCH') {
        try {
            const { id } = req.query;
            const attachmentId = Array.isArray(id) ? id[0] : id;
            const { entity_type, entity_id, perm_scope } = req.body || {};

            if (!attachmentId) {
                return res.status(400).json({ error: 'ID вложения обязателен' });
            }

            if (!(await requirePermission(req, res, DOCUMENT_PERMISSIONS.attach))) return;

            if (!entity_type || !entity_id) {
                return res.status(400).json({ error: 'entity_type и entity_id обязательны' });
            }

            const uploadPerm = getAttachmentPermissionKey(entity_type, 'upload', { scope: perm_scope });
            if (!uploadPerm) {
                return res.status(400).json({ error: 'Некорректный entity_type' });
            }

            if (!(await requirePermission(req, res, uploadPerm))) return;

            const normalizedEntityId = Number(entity_id);
            if (!Number.isInteger(normalizedEntityId) || normalizedEntityId <= 0) {
                return res.status(400).json({ error: 'Некорректный entity_id' });
            }

            const entityCheck = await ensureEntityExists(entity_type, normalizedEntityId);
            if (!entityCheck.rows.length) {
                return res.status(404).json({ error: 'Сущность для привязки не найдена' });
            }

            const attachmentRes = await query(
                `
                SELECT id
                FROM public.attachments
                WHERE id = $1
                LIMIT 1
                `,
                [attachmentId]
            );

            if (attachmentRes.rows.length === 0) {
                return res.status(404).json({ error: 'Документ не найден' });
            }

            await query(
                `
                INSERT INTO public.attachment_links (entity_type, entity_id, attachment_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (entity_type, entity_id, attachment_id) DO NOTHING
                `,
                [entity_type, normalizedEntityId, attachmentId]
            );

            return res.status(200).json({ message: 'Документ привязан' });
        } catch (error) {
            console.error('Error attaching document:', error);
            return res.status(500).json({ error: 'Ошибка привязки документа' });
        }
    }

    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['PATCH', 'DELETE']);
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

        const pool = await getPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (entityType && entityIdRaw) {
                const perm = getAttachmentPermissionKey(entityType, 'delete', { scope: permScope });
                if (!perm) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Некорректный entity_type' });
                }

                if (!(await requirePermission(req, res, perm))) {
                    await client.query('ROLLBACK');
                    return;
                }

                const entityId = Number(entityIdRaw);
                if (!Number.isInteger(entityId) || entityId <= 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Некорректный entity_id' });
                }

                await client.query(
                    `
                    DELETE FROM public.attachment_links
                    WHERE entity_type = $1 AND entity_id = $2 AND attachment_id = $3
                    `,
                    [entityType, entityId, attachmentId]
                );
            } else {
                if (!(await requirePermission(req, res, DOCUMENT_PERMISSIONS.delete))) {
                    await client.query('ROLLBACK');
                    return;
                }

                await client.query('DELETE FROM public.attachment_links WHERE attachment_id = $1', [attachmentId]);
                await client.query('DELETE FROM public.attachments WHERE id = $1', [attachmentId]);
                await client.query('COMMIT');
                return res.status(200).json({ message: 'OK' });
            }

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
