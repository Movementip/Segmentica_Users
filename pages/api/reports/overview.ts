import type { NextApiRequest, NextApiResponse } from 'next';
import { query as rawQuery } from '../../../lib/db';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { REPORT_TAB_PERMISSIONS } from '../../../lib/reportsRbac';

const dbQuery: (text: string, params?: any[]) => Promise<any> = rawQuery;

type OverviewResponse = {
    byMonth: Array<{
        month: string;
        revenue: number;
        expense: number;
        profit: number;
        orders: number;
    }>;
    byCategory: Array<{
        name: string;
        value: number;
        percent: number;
    }>;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<OverviewResponse | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;
    if (
        !hasPermission(actor, REPORT_TAB_PERMISSIONS.overview) &&
        !hasPermission(actor, REPORT_TAB_PERMISSIONS.sales)
    ) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const rawPeriod = Array.isArray(req.query.period) ? req.query.period[0] : req.query.period;
    const period = rawPeriod === '1m' || rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === 'all' ? rawPeriod : '6m';
    const months = period === 'all' ? 12 : period === '6m' ? 6 : period === '3m' ? 3 : 1;

    try {
        const byMonthRes = await dbQuery(
            `
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month',
                    date_trunc('month', CURRENT_DATE),
                    interval '1 month'
                ) AS month_start
            ),
            revenue AS (
                SELECT date_trunc('month', z."дата_создания") AS month_start,
                       COALESCE(SUM(z."общая_сумма"), 0) AS revenue,
                       COUNT(*) AS orders
                FROM "Заявки" z
                WHERE z."статус" IN ('выполнена', 'выполнено')
                  AND z."дата_создания" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                GROUP BY 1
            ),
            purchases AS (
                SELECT date_trunc('month', зак."дата_поступления") AS month_start,
                       COALESCE(SUM(зак."общая_сумма"), 0) AS expense_purchases
                FROM "Закупки" зак
                WHERE зак."статус" = 'получено'
                  AND зак."дата_поступления" IS NOT NULL
                  AND зак."дата_поступления" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                GROUP BY 1
            ),
            payments AS (
                SELECT date_trunc('month', в."дата") AS month_start,
                       COALESCE(SUM(в."сумма"), 0) AS expense_payments
                FROM "Выплаты" в
                WHERE в."дата" IS NOT NULL
                  AND в."дата" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                GROUP BY 1
            ),
            finance AS (
                SELECT date_trunc('month', фк."дата") AS month_start,
                       COALESCE(SUM(фк."сумма"), 0) AS expense_finance
                FROM "Финансы_компании" фк
                WHERE фк."дата" IS NOT NULL
                  AND фк."дата" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                  AND (
                        LOWER(COALESCE(фк."тип"::text, '')) LIKE '%расход%'
                     OR LOWER(COALESCE(фк."тип"::text, '')) LIKE '%спис%'
                     OR LOWER(COALESCE(фк."тип"::text, '')) LIKE '%оплат%'
                  )
                GROUP BY 1
            )
            SELECT
                TO_CHAR(m.month_start::date, 'YYYY-MM') AS month,
                COALESCE(r.revenue, 0) AS revenue,
                COALESCE(r.orders, 0) AS orders,
                COALESCE(p.expense_purchases, 0) AS expense_purchases,
                COALESCE(pay.expense_payments, 0) AS expense_payments,
                COALESCE(f.expense_finance, 0) AS expense_finance
            FROM months m
            LEFT JOIN revenue r ON r.month_start = m.month_start
            LEFT JOIN purchases p ON p.month_start = m.month_start
            LEFT JOIN payments pay ON pay.month_start = m.month_start
            LEFT JOIN finance f ON f.month_start = m.month_start
            ORDER BY m.month_start ASC
            `,
            [months]
        );

        const byMonth = byMonthRes.rows.map((r) => {
            const revenue = Number(r.revenue) || 0;
            const purchasesExpense = Number(r.expense_purchases) || 0;
            const paymentsExpense = Number(r.expense_payments) || 0;
            const financeExpense = Number(r.expense_finance) || 0;
            const expense = purchasesExpense + paymentsExpense + financeExpense;
            const profit = revenue - expense;
            const orders = Number(r.orders) || 0;

            return {
                month: r.month,
                revenue,
                expense,
                profit,
                orders
            };
        });

        const byCategoryRes = await dbQuery(
            `
            SELECT
                k."название" AS name,
                COALESCE(SUM(s."количество"), 0) AS value
            FROM "Склад" s
            JOIN "Товары" t ON s."товар_id" = t.id
            JOIN "Категории_товаров" k ON t."категория_id" = k.id
            WHERE s."количество" > 0
            GROUP BY k."название"
            ORDER BY value DESC
            LIMIT 5
            `
        );

        const categoryRows = byCategoryRes.rows as Array<{ name: string; value: string | number | null }>;
        const sum = categoryRows.reduce((acc, x) => acc + (Number(x.value) || 0), 0) || 1;
        const byCategory = categoryRows.map((x) => {
            const value = Number(x.value) || 0;
            return {
                name: x.name,
                value,
                percent: Math.round((value / sum) * 100)
            };
        });

        return res.status(200).json({ byMonth, byCategory });
    } catch (e) {
        console.error('reports overview error', e);
        return res.status(500).json({ error: 'Failed to build overview' });
    }
}
