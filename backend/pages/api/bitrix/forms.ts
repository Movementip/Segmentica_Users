import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

const KNOWN_BITRIX_FORMS = [
    'Обратный звонок',
    'Заказать продукт',
    'Задать вопрос',
    'Заказать услугу',
    'Купить в 1 клик',
    'Оставить отзыв',
    'Написать сотруднику',
    'Написать директору',
    'Оформление заказа',
    'Отправить резюме',
    'Заказать проект',
];

const normalizeFormKey = (value: unknown) => String(value || '').trim().toLowerCase();

const mapRequestRow = (row: any) => ({
    id: Number(row.id),
    source_system: row.source_system == null ? null : String(row.source_system),
    source_form_id: row.source_form_id == null ? null : Number(row.source_form_id),
    source_form_name: row.source_form_name == null ? null : String(row.source_form_name),
    source_entry_id: row.source_entry_id == null ? null : Number(row.source_entry_id),
    source_entry_name: row.source_entry_name == null ? null : String(row.source_entry_name),
    person_name: row.person_name == null ? null : String(row.person_name),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    product_name: row.product_name == null ? null : String(row.product_name),
    message: row.message == null ? null : String(row.message),
    payload: row.payload || {},
    source_url: row.source_url == null ? null : String(row.source_url),
    source_created_at: row.source_created_at == null ? null : String(row.source_created_at),
    source_updated_at: row.source_updated_at == null ? null : String(row.source_updated_at),
    imported_at: row.imported_at == null ? null : String(row.imported_at),
    last_seen_at: row.last_seen_at == null ? null : String(row.last_seen_at),
    viewed_at: row.viewed_at == null ? null : String(row.viewed_at),
    processed_at: row.processed_at == null ? null : String(row.processed_at),
    notes: row.notes == null ? null : String(row.notes),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    if (!hasPermission(actor, 'orders.bitrix_requests.list')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const [formsResult, requestsResult] = await Promise.all([
            query(`
                SELECT
                    source_form_id,
                    source_form_name,
                    COUNT(*)::integer AS total_count,
                    COUNT(*) FILTER (WHERE processed_at IS NULL)::integer AS open_count,
                    COUNT(*) FILTER (WHERE processed_at IS NOT NULL)::integer AS processed_count,
                    MAX(imported_at) AS last_imported_at,
                    MAX(last_seen_at) AS last_seen_at,
                    MAX(processed_at) AS last_processed_at
                FROM public.imported_requests
                GROUP BY source_form_id, source_form_name
                ORDER BY source_form_name ASC
            `),
            query(`
                SELECT *
                FROM public.imported_requests
                ORDER BY COALESCE(source_created_at, imported_at) DESC, id DESC
                LIMIT 500
            `),
        ]);

        const formsByName = new Map<string, any>();
        for (const name of KNOWN_BITRIX_FORMS) {
            formsByName.set(normalizeFormKey(name), {
                source_form_id: null,
                source_form_name: name,
                total_count: 0,
                open_count: 0,
                processed_count: 0,
                last_imported_at: null,
                last_seen_at: null,
                last_processed_at: null,
                known: true,
            });
        }

        for (const row of formsResult.rows || []) {
            const name = String(row.source_form_name || `Форма #${row.source_form_id || ''}`).trim();
            const key = normalizeFormKey(name);
            formsByName.set(key, {
                source_form_id: row.source_form_id == null ? null : Number(row.source_form_id),
                source_form_name: name,
                total_count: Number(row.total_count) || 0,
                open_count: Number(row.open_count) || 0,
                processed_count: Number(row.processed_count) || 0,
                last_imported_at: row.last_imported_at == null ? null : String(row.last_imported_at),
                last_seen_at: row.last_seen_at == null ? null : String(row.last_seen_at),
                last_processed_at: row.last_processed_at == null ? null : String(row.last_processed_at),
                known: KNOWN_BITRIX_FORMS.some((item) => normalizeFormKey(item) === key),
            });
        }

        const forms = Array.from(formsByName.values()).sort((left, right) => {
            const leftIndex = KNOWN_BITRIX_FORMS.findIndex((name) => normalizeFormKey(name) === normalizeFormKey(left.source_form_name));
            const rightIndex = KNOWN_BITRIX_FORMS.findIndex((name) => normalizeFormKey(name) === normalizeFormKey(right.source_form_name));
            const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
            const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
            if (normalizedLeftIndex !== normalizedRightIndex) return normalizedLeftIndex - normalizedRightIndex;
            return String(left.source_form_name).localeCompare(String(right.source_form_name), 'ru');
        });

        const totalRequests = forms.reduce((sum, form) => sum + Number(form.total_count || 0), 0);
        const openRequests = forms.reduce((sum, form) => sum + Number(form.open_count || 0), 0);
        const processedRequests = forms.reduce((sum, form) => sum + Number(form.processed_count || 0), 0);

        return res.status(200).json({
            forms,
            requests: (requestsResult.rows || []).map(mapRequestRow),
            statistics: {
                forms_count: forms.length,
                total_requests: totalRequests,
                open_requests: openRequests,
                processed_requests: processedRequests,
                empty_forms: forms.filter((form) => Number(form.total_count || 0) === 0).length,
            },
        });
    } catch (error) {
        console.error('Error fetching Bitrix forms:', error);
        return res.status(500).json({
            error: 'Ошибка загрузки форм Битрикс24: ' + (error instanceof Error ? error.message : 'Unknown error'),
        });
    }
}
