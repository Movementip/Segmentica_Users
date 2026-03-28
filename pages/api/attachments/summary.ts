import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

const getAttachmentPermissionKey = (entityType: string, opts?: { scope?: string | null }) => {
    const t = String(entityType || '').trim().toLowerCase();

    if (t === 'product' && String(opts?.scope || '').trim().toLowerCase() === 'warehouse') {
        return 'warehouse-products.attachments.view';
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
    return `${prefix}.attachments.view`;
};

type SummaryItem = {
    entity_id: number;
    types: string[];
};

const normalizeType = (mime: string | null | undefined, filename: string | null | undefined) => {
    const m = (mime || '').toLowerCase();
    const name = (filename || '').toLowerCase();

    if (m.includes('pdf') || name.endsWith('.pdf')) return 'pdf';

    if (
        m.includes('msword') ||
        m.includes('officedocument.wordprocessingml') ||
        name.endsWith('.doc') ||
        name.endsWith('.docx')
    ) {
        return 'word';
    }

    if (
        m.includes('ms-excel') ||
        m.includes('officedocument.spreadsheetml') ||
        name.endsWith('.xls') ||
        name.endsWith('.xlsx')
    ) {
        return 'excel';
    }

    if (m.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return 'image';

    return 'file';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    try {
        const entityTypeRaw = req.query.entity_type;
        const entityIdsRaw = req.query.entity_ids;
        const permScopeRaw = req.query.perm_scope;

        const entity_type = Array.isArray(entityTypeRaw) ? entityTypeRaw[0] : entityTypeRaw;
        const idsStr = Array.isArray(entityIdsRaw) ? entityIdsRaw[0] : entityIdsRaw;
        const perm_scope = Array.isArray(permScopeRaw) ? permScopeRaw[0] : permScopeRaw;

        if (!entity_type || !idsStr) {
            return res.status(400).json({ error: 'entity_type и entity_ids обязательны' });
        }

        const perm = getAttachmentPermissionKey(entity_type, { scope: perm_scope });
        if (!perm) {
            return res.status(400).json({ error: 'Некорректный entity_type' });
        }

        const canView = actor.permissions?.includes(perm);
        if (!canView) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const ids = idsStr
            .split(',')
            .map((x) => Number(String(x).trim()))
            .filter((n) => Number.isInteger(n) && n > 0);

        if (ids.length === 0) {
            return res.status(200).json([] as SummaryItem[]);
        }

        const result = await query(
            `
            SELECT l.entity_id, a.mime_type, a.filename
            FROM public.attachment_links l
            JOIN public.attachments a ON a.id = l.attachment_id
            WHERE l.entity_type = $1
              AND l.entity_id = ANY($2::int[])
            `,
            [entity_type, ids]
        );

        const map = new Map<number, Set<string>>();
        for (const row of result.rows as Array<{ entity_id: number; mime_type: string; filename: string }>) {
            const eid = Number(row.entity_id);
            if (!map.has(eid)) map.set(eid, new Set());
            map.get(eid)!.add(normalizeType(row.mime_type, row.filename));
        }

        const out: SummaryItem[] = Array.from(map.entries()).map(([entity_id, set]) => ({
            entity_id,
            types: Array.from(set.values()),
        }));

        out.sort((a, b) => a.entity_id - b.entity_id);

        return res.status(200).json(out);
    } catch (error) {
        console.error('Error building attachments summary:', error);
        return res.status(500).json({ error: 'Ошибка получения сводки по вложениям' });
    }
}
