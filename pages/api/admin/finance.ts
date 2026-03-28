import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

type FinanceSettings = {
    paymentsPerMonth: 1 | 2;
    firstDay: number;
    secondDay: number | null;
};

type FinanceEmployee = {
    id: number;
    fio: string;
    position: string | null;
    rate: number | null;
    active: boolean;
    totalPaid: number;
    paymentCount: number;
    lastPaymentDate: string | null;
};

type FinancePayment = {
    id: string;
    employeeId: number | null;
    employeeName: string | null;
    amount: number;
    date: string;
    type: string | null;
    status: string | null;
    comment: string | null;
};

type FinanceResponse = {
    settings: FinanceSettings;
    paymentTableAvailable: boolean;
    employees: FinanceEmployee[];
    recentPayments: FinancePayment[];
    totals: {
        activeEmployees: number;
        totalPaid: number;
        paymentCount: number;
    };
};

const SETTINGS_KEY = 'payroll_schedule';

const getTableColumns = async (tableName: string): Promise<Set<string>> => {
    const colsRes = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );
    return new Set((colsRes.rows || []).map((r: any) => String(r.column_name)));
};

const hasTable = async (tableName: string): Promise<boolean> => {
    const res = await query(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists`,
        [tableName]
    );
    return Boolean(res.rows?.[0]?.exists);
};

const pickCol = (cols: Set<string>, preferred: string[]): string | null => {
    for (const col of preferred) {
        if (cols.has(col)) return col;
    }
    return null;
};

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const normalizePositiveInt = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    if (parsed < min || parsed > max) return fallback;
    return parsed;
};

const defaultSettings = (): FinanceSettings => ({
    paymentsPerMonth: 2,
    firstDay: 10,
    secondDay: 25,
});

const ensureAppSettingsTable = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS public.app_settings (
            key text PRIMARY KEY,
            value jsonb NOT NULL DEFAULT '{}'::jsonb,
            updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

const getSettings = async (): Promise<FinanceSettings> => {
    await ensureAppSettingsTable();
    const res = await query(
        `SELECT value
         FROM public.app_settings
         WHERE key = $1
         LIMIT 1`,
        [SETTINGS_KEY]
    );

    const raw = res.rows?.[0]?.value;
    const base = defaultSettings();
    if (!raw || typeof raw !== 'object') return base;

    const paymentsPerMonth = Number((raw as any).paymentsPerMonth) === 1 ? 1 : 2;
    const firstDay = normalizePositiveInt((raw as any).firstDay, base.firstDay, 1, 31);
    const secondDay = paymentsPerMonth === 2 ? normalizePositiveInt((raw as any).secondDay, base.secondDay || 25, 1, 31) : null;

    return { paymentsPerMonth, firstDay, secondDay };
};

const saveSettings = async (settings: FinanceSettings) => {
    await ensureAppSettingsTable();
    await query(
        `
        INSERT INTO public.app_settings(key, value, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `,
        [SETTINGS_KEY, JSON.stringify(settings)]
    );
};

const getPaymentsMeta = async () => {
    const paymentsTableName = 'Выплаты';
    const exists = await hasTable(paymentsTableName);
    if (!exists) {
        return {
            exists: false,
            tableName: paymentsTableName,
            idCol: null,
            employeeCol: null,
            amountCol: null,
            dateCol: null,
            typeCol: null,
            statusCol: null,
            commentCol: null,
        };
    }

    const cols = await getTableColumns(paymentsTableName);
    return {
        exists: true,
        tableName: paymentsTableName,
        idCol: pickCol(cols, ['id']),
        employeeCol: pickCol(cols, ['сотрудник_id', 'employee_id', 'manager_id', 'менеджер_id']),
        amountCol: pickCol(cols, ['сумма', 'amount', 'payment_amount', 'total_amount']),
        dateCol: pickCol(cols, ['дата', 'payment_date', 'paid_at', 'created_at']),
        typeCol: pickCol(cols, ['тип', 'type', 'назначение']),
        statusCol: pickCol(cols, ['статус', 'status']),
        commentCol: pickCol(cols, ['комментарий', 'comment', 'описание', 'description']),
    };
};

const getFinancePayload = async (monthsRequested: number): Promise<FinanceResponse> => {
    const settings = await getSettings();

    const employeesRes = await query(
        `
        SELECT
            id,
            "фио" AS fio,
            "должность" AS position,
            "ставка" AS rate,
            "активен" AS is_active
        FROM public."Сотрудники"
        ORDER BY "фио" ASC
        `
    );

    const employees: FinanceEmployee[] = (employeesRes.rows || []).map((row: any) => ({
        id: Number(row.id),
        fio: String(row.fio || ''),
        position: row.position == null ? null : String(row.position),
        rate: row.rate == null ? null : Number(row.rate),
        active: Boolean(row.is_active),
        totalPaid: 0,
        paymentCount: 0,
        lastPaymentDate: null,
    }));

    const paymentsMeta = await getPaymentsMeta();
    if (!paymentsMeta.exists || !paymentsMeta.idCol || !paymentsMeta.employeeCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
        return {
            settings,
            paymentTableAvailable: false,
            employees,
            recentPayments: [],
            totals: {
                activeEmployees: employees.filter((employee) => employee.active).length,
                totalPaid: 0,
                paymentCount: 0,
            },
        };
    }

    const aggregatesRes = await query(
        `
        SELECT
            ${quoteIdent(paymentsMeta.employeeCol)}::int AS employee_id,
            COALESCE(SUM(${quoteIdent(paymentsMeta.amountCol)}), 0)::numeric AS total_paid,
            COUNT(*)::int AS payment_count,
            MAX(${quoteIdent(paymentsMeta.dateCol)}) AS last_payment_date
        FROM public.${quoteIdent(paymentsMeta.tableName)}
        WHERE ${quoteIdent(paymentsMeta.dateCol)} IS NOT NULL
          AND ${quoteIdent(paymentsMeta.dateCol)} >= (date_trunc('month', CURRENT_DATE) - ($1::int - 1) * interval '1 month')
        GROUP BY ${quoteIdent(paymentsMeta.employeeCol)}
        `,
        [monthsRequested]
    );

    const aggregateByEmployee = new Map<number, { totalPaid: number; paymentCount: number; lastPaymentDate: string | null }>();
    for (const row of aggregatesRes.rows || []) {
        const employeeId = Number(row.employee_id);
        aggregateByEmployee.set(employeeId, {
            totalPaid: Number(row.total_paid) || 0,
            paymentCount: Number(row.payment_count) || 0,
            lastPaymentDate: row.last_payment_date == null ? null : String(row.last_payment_date),
        });
    }

    const mergedEmployees = employees.map((employee) => {
        const aggregate = aggregateByEmployee.get(employee.id);
        return aggregate
            ? { ...employee, ...aggregate }
            : employee;
    });

    const selectFields = [
        `${quoteIdent(paymentsMeta.idCol)}::text AS id`,
        `${quoteIdent(paymentsMeta.employeeCol)}::int AS employee_id`,
        `${quoteIdent(paymentsMeta.amountCol)}::numeric AS amount`,
        `${quoteIdent(paymentsMeta.dateCol)} AS payment_date`,
        `${paymentsMeta.typeCol ? `${quoteIdent(paymentsMeta.typeCol)}::text` : 'NULL::text'} AS payment_type`,
        `${paymentsMeta.statusCol ? `${quoteIdent(paymentsMeta.statusCol)}::text` : 'NULL::text'} AS payment_status`,
        `${paymentsMeta.commentCol ? `${quoteIdent(paymentsMeta.commentCol)}::text` : 'NULL::text'} AS payment_comment`,
        `с."фио" AS employee_name`,
    ];

    const recentPaymentsRes = await query(
        `
        SELECT ${selectFields.join(', ')}
        FROM public.${quoteIdent(paymentsMeta.tableName)} в
        LEFT JOIN public."Сотрудники" с ON с.id = в.${quoteIdent(paymentsMeta.employeeCol)}
        WHERE в.${quoteIdent(paymentsMeta.dateCol)} IS NOT NULL
        ORDER BY в.${quoteIdent(paymentsMeta.dateCol)} DESC, в.${quoteIdent(paymentsMeta.idCol)} DESC
        LIMIT 30
        `
    );

    const recentPayments: FinancePayment[] = (recentPaymentsRes.rows || []).map((row: any) => ({
        id: String(row.id),
        employeeId: row.employee_id == null ? null : Number(row.employee_id),
        employeeName: row.employee_name == null ? null : String(row.employee_name),
        amount: Number(row.amount) || 0,
        date: row.payment_date == null ? '' : String(row.payment_date),
        type: row.payment_type == null ? null : String(row.payment_type),
        status: row.payment_status == null ? null : String(row.payment_status),
        comment: row.payment_comment == null ? null : String(row.payment_comment),
    }));

    return {
        settings,
        paymentTableAvailable: true,
        employees: mergedEmployees,
        recentPayments,
        totals: {
            activeEmployees: mergedEmployees.filter((employee) => employee.active).length,
            totalPaid: mergedEmployees.reduce((sum, employee) => sum + employee.totalPaid, 0),
            paymentCount: mergedEmployees.reduce((sum, employee) => sum + employee.paymentCount, 0),
        },
    };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<FinanceResponse | { ok: true } | { error: string }>) {
    try {
        const actor = await requireDirector(req, res);
        if (!actor) return;

        if (req.method === 'GET') {
            const monthsRaw = Array.isArray(req.query.months) ? req.query.months[0] : req.query.months;
            const monthsParsed = Number(monthsRaw);
            const monthsRequested = [1, 3, 6, 12, 24].includes(monthsParsed) ? monthsParsed : 6;
            const payload = await getFinancePayload(monthsRequested);
            return res.status(200).json(payload);
        }

        const body = req.body || {};
        const action = typeof body.action === 'string' ? body.action.trim() : '';

        if (req.method === 'PUT' && action === 'save-settings') {
            const paymentsPerMonth = Number(body.paymentsPerMonth) === 1 ? 1 : 2;
            const firstDay = normalizePositiveInt(body.firstDay, 10, 1, 31);
            const secondDay = paymentsPerMonth === 2 ? normalizePositiveInt(body.secondDay, 25, 1, 31) : null;

            await saveSettings({ paymentsPerMonth, firstDay, secondDay });
            return res.status(200).json({ ok: true });
        }

        if (req.method === 'PUT' && action === 'update-rate') {
            const employeeId = Number(body.employeeId);
            const rate = body.rate == null || body.rate === '' ? null : Number(body.rate);

            if (!Number.isInteger(employeeId) || employeeId <= 0) {
                return res.status(400).json({ error: 'Некорректный сотрудник' });
            }

            if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
                return res.status(400).json({ error: 'Некорректная ставка' });
            }

            await query(
                `
                UPDATE public."Сотрудники"
                SET "ставка" = $2
                WHERE id = $1
                `,
                [employeeId, rate]
            );

            return res.status(200).json({ ok: true });
        }

        if (req.method === 'POST' && action === 'pay-now') {
            const employeeId = Number(body.employeeId);
            const amount = Number(body.amount);
            const paymentDate = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().slice(0, 10);
            const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

            if (!Number.isInteger(employeeId) || employeeId <= 0) {
                return res.status(400).json({ error: 'Некорректный сотрудник' });
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({ error: 'Сумма должна быть больше нуля' });
            }

            const paymentsMeta = await getPaymentsMeta();
            if (!paymentsMeta.exists || !paymentsMeta.employeeCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
                return res.status(400).json({ error: 'Таблица выплат недоступна для записи' });
            }

            const columns = [quoteIdent(paymentsMeta.employeeCol), quoteIdent(paymentsMeta.amountCol), quoteIdent(paymentsMeta.dateCol)];
            const values: any[] = [employeeId, amount, paymentDate];

            if (paymentsMeta.typeCol) {
                columns.push(quoteIdent(paymentsMeta.typeCol));
                values.push('зарплата');
            }

            if (paymentsMeta.statusCol) {
                columns.push(quoteIdent(paymentsMeta.statusCol));
                values.push('выплачено');
            }

            if (paymentsMeta.commentCol && comment) {
                columns.push(quoteIdent(paymentsMeta.commentCol));
                values.push(comment);
            }

            const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

            await query(
                `
                INSERT INTO public.${quoteIdent(paymentsMeta.tableName)} (${columns.join(', ')})
                VALUES (${placeholders})
                `,
                values
            );

            return res.status(200).json({ ok: true });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    } catch (error) {
        console.error('Finance admin API error:', error);
        return res.status(500).json({ error: 'Ошибка финансового модуля' });
    }
}
