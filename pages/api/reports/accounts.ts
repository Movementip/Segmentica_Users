import type { NextApiRequest, NextApiResponse } from 'next';
import { query as rawQuery } from '../../../lib/db';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { REPORT_TAB_PERMISSIONS } from '../../../lib/reportsRbac';

type AccountAnalyticsRow = {
    account: string;
    amount: number;
    share: number;
    quantity?: number;
    items?: number;
    positions?: number;
    products?: number;
};

type AccountingMovementRow = {
    account: string;
    openingAmount: number;
    incomingAmount: number;
    outgoingAmount: number;
    closingAmount: number;
    openingQuantity: number;
    incomingQuantity: number;
    outgoingQuantity: number;
    closingQuantity: number;
};

type ExpenseMonthRow = {
    month: string;
    total: number;
    accounts: Array<{
        account: string;
        amount: number;
        share: number;
    }>;
};

type ExpenseDetailRow = {
    account: string;
    productId: number | null;
    productName: string;
    nomenclatureType: string | null;
    amount: number;
    records: number;
    share: number;
    shareWithinAccount: number;
};

type AccountsResponse = {
    inventoryByAccount: AccountAnalyticsRow[];
    accountingMovement: AccountingMovementRow[];
    expenseByAccount: AccountAnalyticsRow[];
    expenseStructure: {
        topAccounts: string[];
        byMonth: ExpenseMonthRow[];
    };
    expenseDetails: ExpenseDetailRow[];
    totals: {
        inventoryAmount: number;
        expenseAmount: number;
    };
};

const dbQuery: (text: string, params?: any[]) => Promise<any> = rawQuery;

const normalizePeriod = (rawPeriod: string | undefined) => (
    rawPeriod === '1m' || rawPeriod === '3m' || rawPeriod === '6m' || rawPeriod === 'all' ? rawPeriod : '6m'
);

const toPercent = (value: number, total: number) => {
    if (!total || !Number.isFinite(total)) return 0;
    return Math.round((value / total) * 1000) / 10;
};

const buildMonthLabels = (months: number): string[] => {
    const labels: string[] = [];
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (months - 1));

    for (let idx = 0; idx < months; idx += 1) {
        const current = new Date(start);
        current.setMonth(start.getMonth() + idx);
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        labels.push(`${year}-${month}`);
    }

    return labels;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<AccountsResponse | { error: string }>) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    if (!hasPermission(actor, REPORT_TAB_PERMISSIONS.overview)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const rawPeriod = Array.isArray(req.query.period) ? req.query.period[0] : req.query.period;
    const period = normalizePeriod(rawPeriod);
    const months = period === 'all' ? 12 : period === '6m' ? 6 : period === '3m' ? 3 : 1;

    try {
        const inventoryRes = await dbQuery(
            `
                SELECT
                    COALESCE(NULLIF(TRIM(t."счет_учета"), ''), 'Не указан') AS account,
                    COALESCE(SUM(s."количество"), 0)::numeric AS quantity,
                    COUNT(DISTINCT t.id)::int AS items,
                    COALESCE(SUM(COALESCE(s."количество", 0) * COALESCE(t."цена_закупки", 0)), 0)::numeric AS amount
                FROM "Склад" s
                JOIN "Товары" t ON s."товар_id" = t.id
                WHERE COALESCE(s."количество", 0) > 0
                GROUP BY 1
                ORDER BY amount DESC, quantity DESC
            `
        );

        const accountingMovementRes = await dbQuery(
            `
                WITH movement_in_period AS (
                    SELECT
                        COALESCE(NULLIF(TRIM(t."счет_учета"), ''), 'Не указан') AS account,
                        t.id AS product_id,
                        COALESCE(SUM(CASE WHEN LOWER(COALESCE(ds."тип_операции", '')) = 'приход' THEN ds."количество" ELSE 0 END), 0)::numeric AS incoming_qty,
                        COALESCE(SUM(CASE WHEN LOWER(COALESCE(ds."тип_операции", '')) = 'расход' THEN ds."количество" ELSE 0 END), 0)::numeric AS outgoing_qty,
                        COALESCE(MAX(t."цена_закупки"), 0)::numeric AS purchase_price
                    FROM "Движения_склада" ds
                    JOIN "Товары" t ON t.id = ds."товар_id"
                    WHERE ds."дата_операции" IS NOT NULL
                      AND ds."дата_операции" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                    GROUP BY 1, 2
                ),
                current_stock AS (
                    SELECT
                        COALESCE(NULLIF(TRIM(t."счет_учета"), ''), 'Не указан') AS account,
                        t.id AS product_id,
                        COALESCE(s."количество", 0)::numeric AS closing_qty,
                        COALESCE(t."цена_закупки", 0)::numeric AS purchase_price
                    FROM "Склад" s
                    JOIN "Товары" t ON t.id = s."товар_id"
                ),
                merged AS (
                    SELECT
                        COALESCE(cs.account, mp.account) AS account,
                        COALESCE(cs.product_id, 0) AS product_id,
                        COALESCE(cs.purchase_price, mp.purchase_price, 0)::numeric AS purchase_price,
                        COALESCE(cs.closing_qty, 0)::numeric AS closing_qty,
                        COALESCE(mp.incoming_qty, 0)::numeric AS incoming_qty,
                        COALESCE(mp.outgoing_qty, 0)::numeric AS outgoing_qty
                    FROM current_stock cs
                    FULL OUTER JOIN movement_in_period mp
                        ON mp.account = cs.account
                       AND mp.product_id = cs.product_id
                )
                SELECT
                    account,
                    COALESCE(SUM(CASE WHEN $2::boolean THEN 0 ELSE (closing_qty - incoming_qty + outgoing_qty) END), 0)::numeric AS opening_qty,
                    COALESCE(SUM(incoming_qty), 0)::numeric AS incoming_qty,
                    COALESCE(SUM(outgoing_qty), 0)::numeric AS outgoing_qty,
                    COALESCE(SUM(closing_qty), 0)::numeric AS closing_qty,
                    COALESCE(SUM(CASE WHEN $2::boolean THEN 0 ELSE (closing_qty - incoming_qty + outgoing_qty) * purchase_price END), 0)::numeric AS opening_amount,
                    COALESCE(SUM(incoming_qty * purchase_price), 0)::numeric AS incoming_amount,
                    COALESCE(SUM(outgoing_qty * purchase_price), 0)::numeric AS outgoing_amount,
                    COALESCE(SUM(closing_qty * purchase_price), 0)::numeric AS closing_amount
                FROM merged
                GROUP BY account
                ORDER BY closing_amount DESC, incoming_amount DESC
            `,
            [months, period === 'all']
        );

        const expenseRes = await dbQuery(
            `
                SELECT
                    COALESCE(NULLIF(TRIM(фк."счет_затрат"), ''), 'Не указан') AS account,
                    COUNT(*)::int AS positions,
                    COUNT(DISTINCT фк."товар_id")::int AS products,
                    COALESCE(SUM(фк."сумма"), 0)::numeric AS amount
                FROM "Финансы_компании" фк
                WHERE фк."тип" = 'расход'
                  AND фк."дата" IS NOT NULL
                  AND фк."дата" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                  AND COALESCE(фк."источник", '') = 'закупка'
                GROUP BY 1
                ORDER BY amount DESC, positions DESC
            `,
            [months]
        );

        const expenseMonthRes = await dbQuery(
            `
                SELECT
                    TO_CHAR(date_trunc('month', фк."дата")::date, 'YYYY-MM') AS month,
                    COALESCE(NULLIF(TRIM(фк."счет_затрат"), ''), 'Не указан') AS account,
                    COALESCE(SUM(фк."сумма"), 0)::numeric AS amount
                FROM "Финансы_компании" фк
                WHERE фк."тип" = 'расход'
                  AND фк."дата" IS NOT NULL
                  AND фк."дата" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                  AND COALESCE(фк."источник", '') = 'закупка'
                GROUP BY 1, 2
                ORDER BY 1 ASC, 3 DESC
            `,
            [months]
        );

        const expenseDetailsRes = await dbQuery(
            `
                SELECT
                    COALESCE(NULLIF(TRIM(фк."счет_затрат"), ''), 'Не указан') AS account,
                    фк."товар_id" AS product_id,
                    COALESCE(NULLIF(TRIM(t."название"), ''), 'Без привязки к товару') AS product_name,
                    NULLIF(TRIM(COALESCE(фк."тип_номенклатуры", '')), '') AS nomenclature_type,
                    COUNT(*)::int AS records,
                    COALESCE(SUM(фк."сумма"), 0)::numeric AS amount
                FROM "Финансы_компании" фк
                LEFT JOIN "Товары" t ON t.id = фк."товар_id"
                WHERE фк."тип" = 'расход'
                  AND фк."дата" IS NOT NULL
                  AND фк."дата" >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
                  AND COALESCE(фк."источник", '') = 'закупка'
                GROUP BY 1, 2, 3, 4
                ORDER BY 1 ASC, amount DESC, product_name ASC
            `,
            [months]
        );

        const inventoryRows = inventoryRes.rows.map((row) => ({
            account: String(row.account || 'Не указан'),
            quantity: Number(row.quantity) || 0,
            items: Number(row.items) || 0,
            amount: Number(row.amount) || 0,
        }));

        const accountingMovement: AccountingMovementRow[] = accountingMovementRes.rows.map((row) => ({
            account: String(row.account || 'Не указан'),
            openingAmount: Number(row.opening_amount) || 0,
            incomingAmount: Number(row.incoming_amount) || 0,
            outgoingAmount: Number(row.outgoing_amount) || 0,
            closingAmount: Number(row.closing_amount) || 0,
            openingQuantity: Number(row.opening_qty) || 0,
            incomingQuantity: Number(row.incoming_qty) || 0,
            outgoingQuantity: Number(row.outgoing_qty) || 0,
            closingQuantity: Number(row.closing_qty) || 0,
        })).slice(0, 10);
        const inventoryTotal = inventoryRows.reduce((sum, row) => sum + row.amount, 0);

        const expenseRows = expenseRes.rows.map((row) => ({
            account: String(row.account || 'Не указан'),
            positions: Number(row.positions) || 0,
            products: Number(row.products) || 0,
            amount: Number(row.amount) || 0,
        }));
        const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0);

        const inventoryByAccount: AccountAnalyticsRow[] = inventoryRows.map((row) => ({
            ...row,
            share: toPercent(row.amount, inventoryTotal),
        })).slice(0, 10);

        const expenseByAccount: AccountAnalyticsRow[] = expenseRows.map((row) => ({
            ...row,
            share: toPercent(row.amount, expenseTotal),
        })).slice(0, 10);

        const expenseMonthRows = expenseMonthRes.rows.map((row) => ({
            month: String(row.month),
            account: String(row.account || 'Не указан'),
            amount: Number(row.amount) || 0,
        }));

        const totalsByAccount = new Map<string, number>();
        for (const row of expenseMonthRows) {
            totalsByAccount.set(row.account, (totalsByAccount.get(row.account) || 0) + row.amount);
        }

        const totalsByAccountEntries: Array<[string, number]> = Array.from(totalsByAccount.entries());

        const topAccounts: string[] = totalsByAccountEntries
            .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
            .slice(0, 5)
            .map((entry) => entry[0]);

        const topAccountSet = new Set(topAccounts);
        const byMonthMap = new Map<string, Map<string, number>>();

        for (const month of buildMonthLabels(months)) {
            byMonthMap.set(month, new Map<string, number>());
        }

        for (const row of expenseMonthRows) {
            const monthBucket = byMonthMap.get(row.month) || new Map<string, number>();
            const normalizedAccount = topAccountSet.has(row.account) ? row.account : 'Прочее';
            monthBucket.set(normalizedAccount, (monthBucket.get(normalizedAccount) || 0) + row.amount);
            byMonthMap.set(row.month, monthBucket);
        }

        const monthAccounts = topAccounts.concat(
            expenseMonthRows.some((row) => !topAccountSet.has(row.account)) ? ['Прочее'] : []
        );

        const expenseDetailsRows = expenseDetailsRes.rows.map((row) => ({
            account: String(row.account || 'Не указан'),
            productId: row.product_id == null ? null : Number(row.product_id),
            productName: String(row.product_name || 'Без привязки к товару'),
            nomenclatureType: row.nomenclature_type == null ? null : String(row.nomenclature_type),
            records: Number(row.records) || 0,
            amount: Number(row.amount) || 0,
        }));

        const totalByAccount = new Map<string, number>();
        for (const row of expenseRows) {
            totalByAccount.set(row.account, row.amount);
        }

        const expenseDetails: ExpenseDetailRow[] = expenseDetailsRows
            .map((row) => ({
                ...row,
                share: toPercent(row.amount, expenseTotal),
                shareWithinAccount: toPercent(row.amount, totalByAccount.get(row.account) || 0),
            }))
            .slice(0, 30);

        const byMonth: ExpenseMonthRow[] = Array.from(byMonthMap.entries()).map(([month, monthRows]) => {
            const total = Array.from(monthRows.values()).reduce((sum, value) => sum + value, 0);
            const accounts = monthAccounts
                .map((account) => ({
                    account,
                    amount: monthRows.get(account) || 0,
                    share: toPercent(monthRows.get(account) || 0, total),
                }))
                .filter((row) => row.amount > 0);

            return {
                month,
                total,
                accounts,
            };
        });

        return res.status(200).json({
            inventoryByAccount,
            accountingMovement,
            expenseByAccount,
            expenseStructure: {
                topAccounts: monthAccounts,
                byMonth,
            },
            expenseDetails,
            totals: {
                inventoryAmount: inventoryTotal,
                expenseAmount: expenseTotal,
            },
        });
    } catch (error) {
        console.error('reports accounts error', error);
        return res.status(500).json({ error: 'Failed to build accounts analytics' });
    }
}
