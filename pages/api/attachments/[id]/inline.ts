import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import { requirePermission } from '../../../../lib/auth';

const getAttachmentPermissionKey = (entityType: string, action: 'view', opts?: { scope?: string | null }) => {
    const t = String(entityType || '').trim().toLowerCase();

    if (t === 'product' && String(opts?.scope || '').trim().toLowerCase() === 'warehouse') {
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
    return `${prefix}.attachments.${action}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    try {
        const { id, perm_scope } = req.query;
        const attachmentId = Array.isArray(id) ? id[0] : id;
        const permScope = Array.isArray(perm_scope) ? perm_scope[0] : perm_scope;

        if (!attachmentId) {
            return res.status(400).json({ error: 'ID вложения обязателен' });
        }

        const linkRes = await query(
            `
            SELECT entity_type
            FROM public.attachment_links
            WHERE attachment_id = $1
            ORDER BY entity_type ASC
            LIMIT 1
            `,
            [attachmentId]
        );

        const entityType = linkRes.rows?.[0]?.entity_type as string | undefined;
        if (!entityType) {
            return res.status(404).json({ error: 'Вложение не найдено' });
        }

        const perm = getAttachmentPermissionKey(entityType, 'view', { scope: permScope });
        if (!perm) {
            return res.status(400).json({ error: 'Некорректный entity_type' });
        }

        const actor = await requirePermission(req, res, perm);
        if (!actor) return;

        const result = await query(
            `
            SELECT filename, mime_type, content
            FROM public.attachments
            WHERE id = $1
            `,
            [attachmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Вложение не найдено' });
        }

        const row = result.rows[0] as { filename: string; mime_type: string; content: Buffer };

        res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.filename || 'file')}`);
        res.status(200).send(row.content);
    } catch (error) {
        console.error('Error opening attachment inline:', error);
        res.status(500).json({ error: 'Ошибка открытия вложения' });
    }
}
