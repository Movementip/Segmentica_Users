import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { type File as FormidableFile } from 'formidable';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { getPool, query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

export const config = {
    api: {
        bodyParser: false,
    },
};

type AttachmentListRow = {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
};

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

const readFirstFile = (files: formidable.Files<string>): FormidableFile | null => {
    const fileValues = Object.values(files);
    if (fileValues.length === 0) return null;

    const first = fileValues[0];
    if (!first) return null;

    return Array.isArray(first) ? first[0] ?? null : first;
};

const parseForm = async (req: NextApiRequest): Promise<{ fields: formidable.Fields<string>; file: FormidableFile }> => {
    const form = formidable({
        multiples: false,
        keepExtensions: true,
        maxFileSize: 1024 * 1024 * 1024,
    });

    return await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            const file = readFirstFile(files);
            if (!file) return reject(new Error('Файл не найден'));
            resolve({ fields, file });
        });
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const entity_type_raw = req.query.entity_type;
            const entity_id_raw = req.query.entity_id;
            const perm_scope_raw = req.query.perm_scope;

            const entity_type = Array.isArray(entity_type_raw) ? entity_type_raw[0] : entity_type_raw;
            const entity_id_str = Array.isArray(entity_id_raw) ? entity_id_raw[0] : entity_id_raw;
            const perm_scope = Array.isArray(perm_scope_raw) ? perm_scope_raw[0] : perm_scope_raw;

            if (!entity_type || !entity_id_str) {
                return res.status(400).json({ error: 'entity_type и entity_id обязательны' });
            }

            const perm = getAttachmentPermissionKey(entity_type, 'view', { scope: perm_scope });
            if (!perm) {
                return res.status(400).json({ error: 'Некорректный entity_type' });
            }

            const actor = await requirePermission(req, res, perm);
            if (!actor) return;

            const entity_id = Number(entity_id_str);
            if (!Number.isInteger(entity_id) || entity_id <= 0) {
                return res.status(400).json({ error: 'Некорректный entity_id' });
            }

            const result = await query(
                `
                SELECT a.id, a.filename, a.mime_type, a.size_bytes, a.created_at
                FROM public.attachment_links l
                JOIN public.attachments a ON a.id = l.attachment_id
                WHERE l.entity_type = $1 AND l.entity_id = $2
                ORDER BY a.created_at DESC
                `,
                [entity_type, entity_id]
            );

            return res.status(200).json(result.rows as AttachmentListRow[]);
        } catch (error) {
            console.error('Error listing attachments:', error);
            return res.status(500).json({ error: 'Ошибка получения вложений' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { fields, file } = await parseForm(req);

            const entityTypeRaw = fields.entity_type;
            const entityIdRaw = fields.entity_id;
            const permScopeRaw = fields.perm_scope;

            const entity_type = Array.isArray(entityTypeRaw) ? entityTypeRaw[0] : entityTypeRaw;
            const entity_id_str = Array.isArray(entityIdRaw) ? entityIdRaw[0] : entityIdRaw;
            const perm_scope = Array.isArray(permScopeRaw) ? permScopeRaw[0] : permScopeRaw;

            if (!entity_type || !entity_id_str) {
                return res.status(400).json({ error: 'entity_type и entity_id обязательны' });
            }

            const perm = getAttachmentPermissionKey(entity_type, 'upload', { scope: perm_scope });
            if (!perm) {
                return res.status(400).json({ error: 'Некорректный entity_type' });
            }

            const actor = await requirePermission(req, res, perm);
            if (!actor) return;

            const entity_id = Number(entity_id_str);
            if (!Number.isInteger(entity_id) || entity_id <= 0) {
                return res.status(400).json({ error: 'Некорректный entity_id' });
            }

            const filename = file.originalFilename || 'file';
            const mime_type = file.mimetype || 'application/octet-stream';
            const filepath = (file as any).filepath as string | undefined;

            if (!filepath) {
                return res.status(400).json({ error: 'Не удалось прочитать файл' });
            }

            const buffer = await fs.readFile(filepath);
            const size_bytes = buffer.length;
            const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

            const pool = await getPool();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const insertAttachment = await client.query(
                    `
                    INSERT INTO public.attachments (filename, mime_type, size_bytes, sha256, content)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                    `,
                    [filename, mime_type, size_bytes, sha256, buffer]
                );

                const attachment_id = insertAttachment.rows[0]?.id;
                if (!attachment_id) {
                    throw new Error('Не удалось создать вложение');
                }

                await client.query(
                    `
                    INSERT INTO public.attachment_links (entity_type, entity_id, attachment_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (entity_type, entity_id, attachment_id) DO NOTHING
                    `,
                    [entity_type, entity_id, attachment_id]
                );

                await client.query('COMMIT');

                return res.status(201).json({ id: attachment_id });
            } catch (txError) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('Error rolling back attachment upload transaction:', rollbackError);
                }
                throw txError;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error uploading attachment:', error);

            const message = error instanceof Error ? error.message : 'Ошибка загрузки вложения';
            return res.status(500).json({ error: message });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
}
