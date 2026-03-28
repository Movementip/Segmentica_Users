import type { NextApiRequest, NextApiResponse } from 'next';
import { query as rawQuery } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { REPORT_TAB_PERMISSIONS } from '../../../lib/reportsRbac';

const dbQuery: (text: string, params?: any[]) => Promise<any> = rawQuery;

type Period = 'all' | '6m' | '3m' | '1m';

type TransportPerformanceRow = {
    transport_id: number;
    transport_name: string;
    shipments: number;
    on_time: number;
    rating_percent: number;
    avg_cost: number;
};

type ResponseBody = {
    data: TransportPerformanceRow[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actor = await requirePermission(req, res, REPORT_TAB_PERMISSIONS.logistics);
    if (!actor) return;

    const rawPeriod = Array.isArray(req.query.period) ? req.query.period[0] : req.query.period;
    const period: Period = rawPeriod === '1m' || rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === 'all' ? rawPeriod : '6m';
    const months = period === '6m' ? 6 : period === '3m' ? 3 : 1;

    try {
        const sql = period === 'all'
            ? `
            SELECT
                тк.id AS transport_id,
                тк."название" AS transport_name,
                COALESCE(COUNT(o.id), 0)::int AS shipments,
                COALESCE(COUNT(CASE WHEN COALESCE(o."статус"::text, '') ILIKE 'достав%' THEN 1 END), 0)::int AS on_time,
                CASE
                    WHEN COALESCE(COUNT(o.id), 0) = 0 THEN 0
                    ELSE (COALESCE(COUNT(CASE WHEN COALESCE(o."статус"::text, '') ILIKE 'достав%' THEN 1 END), 0)::float / NULLIF(COUNT(o.id)::float, 0)) * 100
                END AS rating_percent,
                COALESCE(AVG(o."стоимость_доставки"), 0)::float AS avg_cost
            FROM "Транспортные_компании" тк
            LEFT JOIN "Отгрузки" o ON тк.id = o."транспорт_id"
            GROUP BY тк.id, тк."название"
            ORDER BY shipments DESC, rating_percent DESC, transport_name ASC
            LIMIT 10
            `
            : `
            WITH bounds AS (
                SELECT
                    COALESCE(MAX(date_trunc('month', o2."дата_отгрузки")), date_trunc('month', CURRENT_DATE)) AS anchor_month
                FROM "Отгрузки" o2
                WHERE o2."дата_отгрузки" IS NOT NULL
            ),
            wnd AS (
                SELECT
                    (b.anchor_month - ($1::int - 1) * interval '1 month') AS start_date,
                    (b.anchor_month + interval '1 month') AS end_date
                FROM bounds b
            )
            SELECT
                тк.id AS transport_id,
                тк."название" AS transport_name,
                COALESCE(COUNT(o.id), 0)::int AS shipments,
                COALESCE(COUNT(CASE WHEN COALESCE(o."статус"::text, '') ILIKE 'достав%' THEN 1 END), 0)::int AS on_time,
                CASE
                    WHEN COALESCE(COUNT(o.id), 0) = 0 THEN 0
                    ELSE (COALESCE(COUNT(CASE WHEN COALESCE(o."статус"::text, '') ILIKE 'достав%' THEN 1 END), 0)::float / NULLIF(COUNT(o.id)::float, 0)) * 100
                END AS rating_percent,
                COALESCE(AVG(o."стоимость_доставки"), 0)::float AS avg_cost
            FROM "Транспортные_компании" тк
            LEFT JOIN "Отгрузки" o ON тк.id = o."транспорт_id"
            LEFT JOIN wnd w ON TRUE
            WHERE o.id IS NULL
               OR (o."дата_отгрузки" >= w.start_date AND o."дата_отгрузки" < w.end_date)
            GROUP BY тк.id, тк."название"
            ORDER BY shipments DESC, rating_percent DESC, transport_name ASC
            LIMIT 10
            `;

        const result = await dbQuery(sql, period === 'all' ? [] : [months]);

        const rows = (result.rows || []) as any[];
        const data: TransportPerformanceRow[] = rows.map((r) => ({
            transport_id: Number(r.transport_id) || 0,
            transport_name: String(r.transport_name || ''),
            shipments: Number(r.shipments) || 0,
            on_time: Number(r.on_time) || 0,
            rating_percent: Number(r.rating_percent) || 0,
            avg_cost: Number(r.avg_cost) || 0,
        }));

        return res.status(200).json({ data });
    } catch (e) {
        console.error('transport-performance report error', e);
        return res.status(500).json({ error: 'Failed to build transport performance report' });
    }
}
