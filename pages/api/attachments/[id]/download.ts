import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { canAccessAttachmentByLinks, DOCUMENT_PERMISSIONS } from '../../../../lib/attachmentPermissions';

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

        const actor = await requireAuth(req, res);
        if (!actor) return;

        const linkRes = await query(
            `
            SELECT entity_type
            FROM public.attachment_links
            WHERE attachment_id = $1
            ORDER BY entity_type ASC
            `,
            [attachmentId]
        );

        const links = linkRes.rows as Array<{ entity_type: string }>;

        const canOpen = links.length === 0
            ? hasPermission(actor, DOCUMENT_PERMISSIONS.view)
            : canAccessAttachmentByLinks(actor, links, { scope: permScope });

        if (!canOpen) {
            return res.status(403).json({ error: 'Forbidden' });
        }

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
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.filename || 'file')}`);
        res.status(200).send(row.content);
    } catch (error) {
        console.error('Error downloading attachment:', error);
        res.status(500).json({ error: 'Ошибка скачивания вложения' });
    }
}
