import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { type File as FormidableFile } from 'formidable';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { getPool, query } from '../../../lib/db';
import {
    ATTACHMENT_ENTITY_LABELS,
    DOCUMENT_PERMISSIONS,
    getAttachmentEntityHref,
    getAttachmentPermissionKey,
    normalizeAttachmentEntityType,
    type AttachmentEntityType,
} from '../../../lib/attachmentPermissions';
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

type AttachmentRegistryLink = {
    entity_type: AttachmentEntityType;
    entity_id: number;
    entity_label: string;
    title: string;
    subtitle: string | null;
    href: string | null;
};

type AttachmentRegistryRow = AttachmentListRow & {
    links: AttachmentRegistryLink[];
    is_unattached: boolean;
};

type EntityPresentation = {
    title: string;
    subtitle: string | null;
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

const fetchEntityPresentationMap = async (entityType: AttachmentEntityType, ids: number[]) => {
    if (ids.length === 0) {
        return new Map<number, EntityPresentation>();
    }

    const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueIds.length === 0) {
        return new Map<number, EntityPresentation>();
    }

    switch (entityType) {
        case 'order': {
            const result = await query(
                `
                SELECT
                    z.id,
                    COALESCE(c."название", 'Без контрагента') AS client_name,
                    COALESCE(z."статус", 'новая') AS status
                FROM public."Заявки" z
                LEFT JOIN public."Клиенты" c ON c.id = z."клиент_id"
                WHERE z.id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: `Заявка #${row.id}`,
                        subtitle: `${row.client_name}${row.status ? ` • ${row.status}` : ''}`,
                    },
                ])
            );
        }
        case 'client': {
            const result = await query(
                `
                SELECT id, "название", "тип", "телефон"
                FROM public."Клиенты"
                WHERE id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: String(row.название),
                        subtitle: row.тип || row.телефон || null,
                    },
                ])
            );
        }
        case 'purchase': {
            const result = await query(
                `
                SELECT
                    p.id,
                    COALESCE(s."название", 'Без поставщика') AS supplier_name,
                    COALESCE(p."статус", 'заказано') AS status
                FROM public."Закупки" p
                LEFT JOIN public."Поставщики" s ON s.id = p."поставщик_id"
                WHERE p.id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: `Закупка #${row.id}`,
                        subtitle: `${row.supplier_name}${row.status ? ` • ${row.status}` : ''}`,
                    },
                ])
            );
        }
        case 'shipment': {
            const result = await query(
                `
                SELECT
                    s.id,
                    s."заявка_id",
                    COALESCE(s."статус", 'в пути') AS status
                FROM public."Отгрузки" s
                WHERE s.id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: `Отгрузка #${row.id}`,
                        subtitle: `${row.заявка_id ? `Заявка #${row.заявка_id} • ` : ''}${row.status}`,
                    },
                ])
            );
        }
        case 'supplier': {
            const result = await query(
                `
                SELECT id, "название", "телефон"
                FROM public."Поставщики"
                WHERE id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: String(row.название),
                        subtitle: row.телефон || null,
                    },
                ])
            );
        }
        case 'transport': {
            const result = await query(
                `
                SELECT id, "название", "телефон"
                FROM public."Транспортные_компании"
                WHERE id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: String(row.название),
                        subtitle: row.телефон || null,
                    },
                ])
            );
        }
        case 'manager': {
            const result = await query(
                `
                SELECT id, "фио", "должность"
                FROM public."Сотрудники"
                WHERE id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: String(row.фио),
                        subtitle: row.должность || null,
                    },
                ])
            );
        }
        case 'product': {
            const result = await query(
                `
                SELECT id, "название", "артикул"
                FROM public."Товары"
                WHERE id = ANY($1::int[])
                `,
                [uniqueIds]
            );

            return new Map<number, EntityPresentation>(
                result.rows.map((row: any) => [
                    Number(row.id),
                    {
                        title: String(row.название),
                        subtitle: row.артикул ? `Артикул: ${row.артикул}` : null,
                    },
                ])
            );
        }
        default:
            return new Map<number, EntityPresentation>();
    }
};

const buildRegistryRows = async (
    rows: Array<{
        id: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        created_at: string;
        entity_type: string | null;
        entity_id: number | null;
    }>
) => {
    const grouped = new Map<string, AttachmentRegistryRow>();
    const linkSeedsByType = new Map<AttachmentEntityType, number[]>();

    for (const row of rows) {
        if (!grouped.has(row.id)) {
            grouped.set(row.id, {
                id: row.id,
                filename: row.filename,
                mime_type: row.mime_type,
                size_bytes: Number(row.size_bytes) || 0,
                created_at: row.created_at,
                links: [],
                is_unattached: true,
            });
        }

        const normalizedType = normalizeAttachmentEntityType(row.entity_type);
        const normalizedId = Number(row.entity_id);

        if (!normalizedType || !Number.isInteger(normalizedId) || normalizedId <= 0) {
            continue;
        }

        grouped.get(row.id)!.is_unattached = false;
        grouped.get(row.id)!.links.push({
            entity_type: normalizedType,
            entity_id: normalizedId,
            entity_label: ATTACHMENT_ENTITY_LABELS[normalizedType],
            title: `${ATTACHMENT_ENTITY_LABELS[normalizedType]} #${normalizedId}`,
            subtitle: null,
            href: getAttachmentEntityHref(normalizedType, normalizedId),
        });

        const currentIds = linkSeedsByType.get(normalizedType) || [];
        currentIds.push(normalizedId);
        linkSeedsByType.set(normalizedType, currentIds);
    }

    const presentationMaps = new Map<AttachmentEntityType, Map<number, EntityPresentation>>();
    for (const [entityType, ids] of Array.from(linkSeedsByType.entries())) {
        presentationMaps.set(entityType, await fetchEntityPresentationMap(entityType, ids));
    }

    for (const attachment of Array.from(grouped.values())) {
        attachment.links = attachment.links.map((link) => {
            const presentation = presentationMaps.get(link.entity_type)?.get(link.entity_id);
            if (!presentation) return link;
            return {
                ...link,
                title: presentation.title,
                subtitle: presentation.subtitle,
            };
        });
    }

    return Array.from(grouped.values()).sort((left, right) => {
        const dateDiff = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        if (dateDiff !== 0) return dateDiff;
        return left.filename.localeCompare(right.filename, 'ru');
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const registryMode = String(Array.isArray(req.query.registry) ? req.query.registry[0] : req.query.registry || '').trim() === '1';

            if (registryMode) {
                if (!(await requirePermission(req, res, DOCUMENT_PERMISSIONS.view))) return;

                const result = await query(
                    `
                    SELECT
                        a.id,
                        a.filename,
                        a.mime_type,
                        COALESCE(NULLIF(a.size_bytes, 0), octet_length(a.content), 0)::integer AS size_bytes,
                        a.created_at,
                        l.entity_type,
                        l.entity_id
                    FROM public.attachments a
                    LEFT JOIN public.attachment_links l ON l.attachment_id = a.id
                    ORDER BY a.created_at DESC, a.id DESC, l.entity_type ASC NULLS LAST, l.entity_id ASC NULLS LAST
                    `
                );

                const rows = await buildRegistryRows(result.rows as Array<any>);
                return res.status(200).json(rows);
            }

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

            if (!(await requirePermission(req, res, perm))) return;

            const entity_id = Number(entity_id_str);
            if (!Number.isInteger(entity_id) || entity_id <= 0) {
                return res.status(400).json({ error: 'Некорректный entity_id' });
            }

            const result = await query(
                `
                SELECT
                    a.id,
                    a.filename,
                    a.mime_type,
                    COALESCE(NULLIF(a.size_bytes, 0), octet_length(a.content), 0)::integer AS size_bytes,
                    a.created_at
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

            if (entity_type && entity_id_str) {
                const perm = getAttachmentPermissionKey(entity_type, 'upload', { scope: perm_scope });
                if (!perm) {
                    return res.status(400).json({ error: 'Некорректный entity_type' });
                }

                if (!(await requirePermission(req, res, perm))) return;

                const entity_id = Number(entity_id_str);
                if (!Number.isInteger(entity_id) || entity_id <= 0) {
                    return res.status(400).json({ error: 'Некорректный entity_id' });
                }
            } else {
                if (!(await requirePermission(req, res, DOCUMENT_PERMISSIONS.upload))) return;
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

                if (entity_type && entity_id_str) {
                    await client.query(
                        `
                        INSERT INTO public.attachment_links (entity_type, entity_id, attachment_id)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (entity_type, entity_id, attachment_id) DO NOTHING
                        `,
                        [entity_type, Number(entity_id_str), attachment_id]
                    );
                }

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
