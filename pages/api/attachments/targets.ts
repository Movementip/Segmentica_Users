import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { DOCUMENT_PERMISSIONS, getAttachmentPermissionKey, normalizeAttachmentEntityType, type AttachmentEntityType } from '../../../lib/attachmentPermissions';

type TargetSearchRow = {
    id: number;
    title: string;
    subtitle: string | null;
};

const normalizeQuery = (value: unknown) => String(value || '').trim();

const buildMatch = (parts: string[]) => `
    LOWER(CONCAT_WS(' ', ${parts.join(', ')})) LIKE LOWER($3)
`;

const fetchTargets = async (entityType: AttachmentEntityType, search: string, limit: number): Promise<TargetSearchRow[]> => {
    const q = search.trim();
    const like = `%${q}%`;
    const numericId = Number(q);

    switch (entityType) {
        case 'order': {
            const result = await query(
                `
                SELECT
                    z.id,
                    ('Заявка #' || z.id)::text AS title,
                    (COALESCE(c."название", 'Без контрагента') || ' • ' || COALESCE(z."статус", 'новая'))::text AS subtitle
                FROM public."Заявки" z
                LEFT JOIN public."Клиенты" c ON c.id = z."клиент_id"
                WHERE (
                    $1 = ''
                    OR z.id = $2
                    OR ${buildMatch([
                        `COALESCE(c."название", '')`,
                        `COALESCE(c."краткое_название", '')`,
                        `COALESCE(c."полное_название", '')`,
                        `COALESCE(c."фамилия", '')`,
                        `COALESCE(c."имя", '')`,
                        `COALESCE(c."отчество", '')`,
                        `COALESCE(z."статус", '')`,
                        `COALESCE(z."адрес_доставки", '')`,
                    ])}
                )
                ORDER BY z.id DESC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'client': {
            const result = await query(
                `
                SELECT
                    id,
                    COALESCE(NULLIF("название", ''), NULLIF("краткое_название", ''), NULLIF("полное_название", ''), ('Контрагент #' || id))::text AS title,
                    COALESCE(
                        NULLIF("полное_название", ''),
                        NULLIF("краткое_название", ''),
                        NULLIF("тип", ''),
                        NULLIF("телефон", ''),
                        NULLIF("email", '')
                    )::text AS subtitle
                FROM public."Клиенты"
                WHERE (
                    $1 = ''
                    OR id = $2
                    OR ${buildMatch([
                        `COALESCE("название", '')`,
                        `COALESCE("краткое_название", '')`,
                        `COALESCE("полное_название", '')`,
                        `COALESCE("фамилия", '')`,
                        `COALESCE("имя", '')`,
                        `COALESCE("отчество", '')`,
                        `COALESCE("телефон", '')`,
                        `COALESCE("email", '')`,
                        `COALESCE("инн", '')`,
                        `COALESCE("кпп", '')`,
                        `COALESCE("огрн", '')`,
                        `COALESCE("огрнип", '')`,
                        `COALESCE("окпо", '')`,
                        `COALESCE("адрес_регистрации", '')`,
                        `COALESCE("адрес_печати", '')`,
                        `COALESCE("комментарий", '')`,
                    ])}
                )
                ORDER BY COALESCE(NULLIF("название", ''), NULLIF("краткое_название", ''), NULLIF("полное_название", '')) ASC, id ASC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'purchase': {
            const result = await query(
                `
                SELECT
                    p.id,
                    ('Закупка #' || p.id)::text AS title,
                    (
                        COALESCE(
                            NULLIF(s."название", ''),
                            NULLIF(s."краткое_название", ''),
                            NULLIF(s."полное_название", ''),
                            'Без поставщика'
                        ) || ' • ' || COALESCE(p."статус", 'заказано')
                    )::text AS subtitle
                FROM public."Закупки" p
                LEFT JOIN public."Поставщики" s ON s.id = p."поставщик_id"
                WHERE (
                    $1 = ''
                    OR p.id = $2
                    OR ${buildMatch([
                        `COALESCE(s."название", '')`,
                        `COALESCE(s."краткое_название", '')`,
                        `COALESCE(s."полное_название", '')`,
                        `COALESCE(s."фамилия", '')`,
                        `COALESCE(s."имя", '')`,
                        `COALESCE(s."отчество", '')`,
                        `COALESCE(p."статус", '')`,
                        `COALESCE(p."заявка_id"::text, '')`,
                        `COALESCE(p."поставщик_id"::text, '')`,
                        `COALESCE(p."транспорт_id"::text, '')`,
                    ])}
                )
                ORDER BY p.id DESC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'shipment': {
            const result = await query(
                `
                SELECT
                    s.id,
                    ('Отгрузка #' || s.id)::text AS title,
                    (
                        CASE
                            WHEN s."заявка_id" IS NOT NULL
                                THEN 'Заявка #' || s."заявка_id" || ' • ' || COALESCE(s."статус", 'в пути')
                            ELSE COALESCE(s."статус", 'в пути')
                        END
                    )::text AS subtitle
                FROM public."Отгрузки" s
                LEFT JOIN public."Заявки" z ON z.id = s."заявка_id"
                LEFT JOIN public."Клиенты" c ON c.id = z."клиент_id"
                LEFT JOIN public."Транспортные_компании" t ON t.id = s."транспорт_id"
                WHERE (
                    $1 = ''
                    OR s.id = $2
                    OR ${buildMatch([
                        `COALESCE(s."статус", '')`,
                        `COALESCE(s."заявка_id"::text, '')`,
                        `COALESCE(s."транспорт_id"::text, '')`,
                        `COALESCE(s."номер_отслеживания", '')`,
                        `COALESCE(c."название", '')`,
                        `COALESCE(c."краткое_название", '')`,
                        `COALESCE(c."полное_название", '')`,
                        `COALESCE(c."фамилия", '')`,
                        `COALESCE(c."имя", '')`,
                        `COALESCE(c."отчество", '')`,
                        `COALESCE(t."название", '')`,
                    ])}
                )
                ORDER BY s.id DESC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'supplier': {
            const result = await query(
                `
                SELECT
                    id,
                    COALESCE(NULLIF("название", ''), NULLIF("краткое_название", ''), NULLIF("полное_название", ''), ('Поставщик #' || id))::text AS title,
                    COALESCE(
                        NULLIF("полное_название", ''),
                        NULLIF("краткое_название", ''),
                        NULLIF("телефон", ''),
                        NULLIF("email", '')
                    )::text AS subtitle
                FROM public."Поставщики"
                WHERE (
                    $1 = ''
                    OR id = $2
                    OR ${buildMatch([
                        `COALESCE("название", '')`,
                        `COALESCE("краткое_название", '')`,
                        `COALESCE("полное_название", '')`,
                        `COALESCE("фамилия", '')`,
                        `COALESCE("имя", '')`,
                        `COALESCE("отчество", '')`,
                        `COALESCE("телефон", '')`,
                        `COALESCE("email", '')`,
                        `COALESCE("инн", '')`,
                        `COALESCE("кпп", '')`,
                        `COALESCE("огрн", '')`,
                        `COALESCE("огрнип", '')`,
                        `COALESCE("окпо", '')`,
                        `COALESCE("адрес_регистрации", '')`,
                        `COALESCE("адрес_печати", '')`,
                        `COALESCE("комментарий", '')`,
                    ])}
                )
                ORDER BY COALESCE(NULLIF("название", ''), NULLIF("краткое_название", ''), NULLIF("полное_название", '')) ASC, id ASC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'transport': {
            const result = await query(
                `
                SELECT
                    id,
                    "название"::text AS title,
                    COALESCE("телефон", "email")::text AS subtitle
                FROM public."Транспортные_компании"
                WHERE (
                    $1 = ''
                    OR id = $2
                    OR ${buildMatch([
                        `COALESCE("название", '')`,
                        `COALESCE("телефон", '')`,
                        `COALESCE("email", '')`,
                        `COALESCE("тариф"::text, '')`,
                    ])}
                )
                ORDER BY "название" ASC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'manager': {
            const result = await query(
                `
                SELECT
                    id,
                    "фио"::text AS title,
                    COALESCE("должность", "телефон", "email")::text AS subtitle
                FROM public."Сотрудники"
                WHERE (
                    $1 = ''
                    OR id = $2
                    OR ${buildMatch([
                        `COALESCE("фио", '')`,
                        `COALESCE("должность", '')`,
                        `COALESCE("телефон", '')`,
                        `COALESCE("email", '')`,
                    ])}
                )
                ORDER BY "фио" ASC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        case 'product': {
            const result = await query(
                `
                SELECT
                    id,
                    "название"::text AS title,
                    CASE
                        WHEN COALESCE("артикул", '') <> ''
                            THEN ('Артикул: ' || "артикул")::text
                        ELSE NULL
                    END AS subtitle
                FROM public."Товары"
                WHERE (
                    $1 = ''
                    OR id = $2
                    OR ${buildMatch([
                        `COALESCE("название", '')`,
                        `COALESCE("артикул", '')`,
                    ])}
                )
                ORDER BY "название" ASC
                LIMIT $4
                `,
                [q, Number.isFinite(numericId) ? numericId : -1, like, limit]
            );
            return result.rows as TargetSearchRow[];
        }
        default:
            return [];
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    try {
        const actor = await requireAuth(req, res);
        if (!actor) return;

        if (!hasPermission(actor, DOCUMENT_PERMISSIONS.attach)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const entityTypeRaw = Array.isArray(req.query.entity_type) ? req.query.entity_type[0] : req.query.entity_type;
        const searchQuery = normalizeQuery(Array.isArray(req.query.q) ? req.query.q[0] : req.query.q);
        const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const limit = Math.min(Math.max(Number(limitRaw) || 12, 1), 30);

        const entityType = normalizeAttachmentEntityType(entityTypeRaw);
        if (!entityType) {
            return res.status(400).json({ error: 'Некорректный entity_type' });
        }

        const uploadPerm = getAttachmentPermissionKey(entityType, 'upload');
        if (!uploadPerm || !hasPermission(actor, uploadPerm)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const rows = await fetchTargets(entityType, searchQuery, limit);
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error loading attachment targets:', error);
        return res.status(500).json({ error: 'Ошибка загрузки списка привязки' });
    }
}
