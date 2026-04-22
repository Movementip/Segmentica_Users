import type { NextApiRequest, NextApiResponse } from 'next';
import { query as rawQuery } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { REPORT_TAB_PERMISSIONS } from '../../../lib/reportsRbac';

const dbQuery: (text: string, params?: any[]) => Promise<any> = rawQuery;

type Period = 'all' | '6m' | '3m' | '1m';

type TopProductRow = {
    product_id: number;
    product_name: string;
    sold_units: number;
    revenue: number;
    margin_percent: number;
    trend_percent: number;
};

type ResponseBody = {
    data: TopProductRow[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actor = await requirePermission(req, res, REPORT_TAB_PERMISSIONS.products);
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
                    pz."товар_id" AS product_id,
                    t."название" AS product_name,
                    SUM(CASE WHEN z."дата_создания" >= b.cur_start AND z."дата_создания" < b.cur_end THEN pz."количество" ELSE 0 END) AS sold_units,
                    SUM(CASE WHEN z."дата_создания" >= b.cur_start AND z."дата_создания" < b.cur_end THEN pz."количество" * pz."цена" ELSE 0 END) AS revenue_cur,
                    SUM(CASE WHEN z."дата_создания" >= b.cur_start AND z."дата_создания" < b.cur_end THEN pz."количество" * COALESCE(t."цена_закупки", 0) ELSE 0 END) AS cost_cur,
                    SUM(CASE WHEN z."дата_создания" >= b.prev_start AND z."дата_создания" < b.prev_end THEN pz."количество" * pz."цена" ELSE 0 END) AS revenue_prev
                FROM "Позиции_заявки" pz
                JOIN "Заявки" z ON z.id = pz."заявка_id"
                JOIN "Товары" t ON t.id = pz."товар_id"
                CROSS JOIN bounds b
                WHERE z."статус" IN ('выполнена', 'выполнено')
                  AND z."дата_создания" >= (SELECT prev_start FROM bounds)
                  AND z."дата_создания" < (SELECT cur_end FROM bounds)
                GROUP BY pz."товар_id", t."название"
            )
            SELECT
                product_id,
                product_name,
                COALESCE(sold_units, 0)::int AS sold_units,
                COALESCE(revenue_cur, 0)::float AS revenue,
                CASE
                    WHEN COALESCE(revenue_cur, 0) = 0 THEN 0
                    ELSE ((COALESCE(revenue_cur, 0) - COALESCE(cost_cur, 0)) / NULLIF(COALESCE(revenue_cur, 0), 0)) * 100
                END AS margin_percent,
                CASE
                    WHEN COALESCE(revenue_prev, 0) = 0 THEN CASE WHEN COALESCE(revenue_cur, 0) > 0 THEN 100 ELSE 0 END
                    ELSE ((COALESCE(revenue_cur, 0) - COALESCE(revenue_prev, 0)) / NULLIF(COALESCE(revenue_prev, 0), 0)) * 100
                END AS trend_percent
            FROM base
            ORDER BY revenue DESC
            LIMIT 10
            `,
            [months]
        );

        const rows = (result.rows || []) as any[];
        const data: TopProductRow[] = rows.map((r) => ({
            product_id: Number(r.product_id) || 0,
            product_name: String(r.product_name || ''),
            sold_units: Number(r.sold_units) || 0,
            revenue: Number(r.revenue) || 0,
            margin_percent: Number(r.margin_percent) || 0,
            trend_percent: Number(r.trend_percent) || 0,
        }));

        return res.status(200).json({ data });
    } catch (e) {
        console.error('top-products report error', e);
        return res.status(500).json({ error: 'Failed to build top products report' });
    }
}
