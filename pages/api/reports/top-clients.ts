import type { NextApiRequest, NextApiResponse } from 'next';
import { query as rawQuery } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { REPORT_TAB_PERMISSIONS } from '../../../lib/reportsRbac';

const dbQuery: (text: string, params?: any[]) => Promise<any> = rawQuery;

type Period = 'all' | '6m' | '3m' | '1m';

type TopClientRow = {
    client_id: number;
    client_name: string;
    orders_count: number;
    revenue: number;
    avg_check: number;
    growth_percent: number;
};

type ResponseBody = {
    data: TopClientRow[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actor = await requirePermission(req, res, REPORT_TAB_PERMISSIONS.clients);
    if (!actor) return;

    const rawPeriod = Array.isArray(req.query.period) ? req.query.period[0] : req.query.period;
    const period: Period = rawPeriod === '1m' || rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === 'all' ? rawPeriod : '6m';
    const months = period === 'all' ? 12 : period === '6m' ? 6 : period === '3m' ? 3 : 1;

    try {
        const result = await dbQuery(
            `
            WITH bounds AS (
                SELECT
                    date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month' AS cur_start,
                    date_trunc('month', CURRENT_DATE) + interval '1 month' AS cur_end,
                    date_trunc('month', CURRENT_DATE) - ($1::int * 2 - 1) * interval '1 month' AS prev_start,
                    date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month' AS prev_end
            ),
            base AS (
                SELECT
                    z."клиент_id" AS client_id,
                    k."название" AS client_name,
                    COUNT(*) FILTER (WHERE z."дата_создания" >= b.cur_start AND z."дата_создания" < b.cur_end) AS orders_count,
                    SUM(CASE WHEN z."дата_создания" >= b.cur_start AND z."дата_создания" < b.cur_end THEN z."общая_сумма" ELSE 0 END) AS revenue_cur,
                    SUM(CASE WHEN z."дата_создания" >= b.prev_start AND z."дата_создания" < b.prev_end THEN z."общая_сумма" ELSE 0 END) AS revenue_prev
                FROM "Заявки" z
                JOIN "Клиенты" k ON z."клиент_id" = k.id
                CROSS JOIN bounds b
                WHERE z."статус" IN ('выполнена', 'выполнено')
                  AND z."дата_создания" >= (SELECT prev_start FROM bounds)
                  AND z."дата_создания" < (SELECT cur_end FROM bounds)
                GROUP BY z."клиент_id", k."название"
            )
            SELECT
                client_id,
                client_name,
                COALESCE(orders_count, 0)::int AS orders_count,
                COALESCE(revenue_cur, 0)::float AS revenue,
                CASE
                    WHEN COALESCE(orders_count, 0) = 0 THEN 0
                    ELSE (COALESCE(revenue_cur, 0) / NULLIF(COALESCE(orders_count, 0), 0))
                END AS avg_check,
                CASE
                    WHEN COALESCE(revenue_prev, 0) = 0 THEN CASE WHEN COALESCE(revenue_cur, 0) > 0 THEN 100 ELSE 0 END
                    ELSE ((COALESCE(revenue_cur, 0) - COALESCE(revenue_prev, 0)) / NULLIF(COALESCE(revenue_prev, 0), 0)) * 100
                END AS growth_percent
            FROM base
            ORDER BY revenue DESC
            LIMIT 10
            `,
            [months]
        );

        const rows = (result.rows || []) as any[];
        const data: TopClientRow[] = rows.map((r) => ({
            client_id: Number(r.client_id) || 0,
            client_name: String(r.client_name || ''),
            orders_count: Number(r.orders_count) || 0,
            revenue: Number(r.revenue) || 0,
            avg_check: Number(r.avg_check) || 0,
            growth_percent: Number(r.growth_percent) || 0,
        }));

        return res.status(200).json({ data });
    } catch (e) {
        console.error('top-clients report error', e);
        return res.status(500).json({ error: 'Failed to build top clients report' });
    }
}
