import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireDirector } from '../../../lib/auth';

export type FinanceSettings = {
    paymentsPerMonth: 1 | 2;
    firstDay: number;
    secondDay: number | null;
};

export type FinanceEmployee = {
    id: number;
    fio: string;
    position: string | null;
    rate: number | null;
    active: boolean;
    totalPaid: number;
    paymentCount: number;
    lastPaymentDate: string | null;
    currentAccrued: number;
    currentWithheld: number;
    currentPaid: number;
    currentPayable: number;
    suggestedPayments: FinanceSuggestedPayment[];
    paymentHistory: FinancePayment[];
};

export type FinancePayment = {
    id: string;
    employeeId: number | null;
    employeeName: string | null;
    amount: number;
    date: string;
    type: string | null;
    status: string | null;
    comment: string | null;
    accruedAmount: number;
    withheldAmount: number;
    paidAmount: number;
    payableAmount: number;
    paymentKind: string | null;
    periodFrom: string | null;
    periodTo: string | null;
    calculation: Record<string, any> | null;
};

export type FinanceSuggestedPayment = {
    key: string;
    type: 'advance' | 'salary_cycle' | 'vacation' | 'bonus';
    encodedType: string;
    label: string;
    amount: number;
    accruedAmount: number;
    withheldAmount: number;
    paidAmount: number;
    payableAmount: number;
    recommendedDate: string;
    periodFrom: string | null;
    periodTo: string | null;
    note: string | null;
    sourceSummary: string | null;
};

export type FinanceResponse = {
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
const VACATION_PAYMENT_PREFIX = 'отпускные#';
const ADVANCE_PAYMENT_PREFIX = 'аванс#';
const SALARY_PAYMENT_PREFIX = 'зарплата#';
const DEFAULT_TAX_RATE = 0.13;

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

const parseDateOnly = (value: unknown): Date | null => {
    if (!value) return null;

    if (value instanceof Date) {
        return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }

    const raw = String(value).trim();
    const normalized = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        const parsed = new Date(`${normalized}T00:00:00Z`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number): Date => {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const addMonths = (value: Date, months: number): Date => {
    const next = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
    next.setUTCMonth(next.getUTCMonth() + months);
    return next;
};

const startOfMonth = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const endOfMonth = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

const daysInMonth = (value: Date): number => endOfMonth(value).getUTCDate();

const clampDayToMonth = (year: number, month: number, day: number): Date =>
    new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));

const enumerateDays = (dateFrom: Date, dateTo: Date): Date[] => {
    const days: Date[] = [];
    for (let cursor = new Date(dateFrom); cursor <= dateTo; cursor = addDays(cursor, 1)) {
        days.push(new Date(cursor));
    }
    return days;
};

const enumeratePaymentDates = (settings: FinanceSettings, dateFrom: Date, dateTo: Date): Date[] => {
    const unique = new Map<string, Date>();
    const start = addMonths(startOfMonth(dateFrom), -1);
    const finish = addMonths(startOfMonth(dateTo), 1);

    for (let cursor = new Date(start); cursor <= finish; cursor = addMonths(cursor, 1)) {
        const year = cursor.getUTCFullYear();
        const month = cursor.getUTCMonth();
        const candidates = settings.paymentsPerMonth === 1
            ? [settings.firstDay]
            : [settings.firstDay, settings.secondDay || settings.firstDay];

        for (const day of candidates) {
            const paymentDate = clampDayToMonth(year, month, day);
            unique.set(formatDateOnly(paymentDate), paymentDate);
        }
    }

    return Array.from(unique.values()).sort((a, b) => a.getTime() - b.getTime());
};

const computeCalendarAmount = (rate: number, days: Date[]): number =>
    days.reduce((sum, day) => sum + rate / daysInMonth(day), 0);

const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

const computeWithholdingAmount = (grossAmount: number, rate = DEFAULT_TAX_RATE): number =>
    roundMoney(grossAmount * rate);

const computeNetAmount = (grossAmount: number, withheldAmount: number): number =>
    roundMoney(grossAmount - withheldAmount);

const normalizePaymentType = (value: unknown): string | null => {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
};

const normalizeOptionalText = (value: unknown): string | null => {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
};

const displayPaymentType = (value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith(VACATION_PAYMENT_PREFIX)) return 'Отпускные';
    if (value.startsWith(ADVANCE_PAYMENT_PREFIX)) return 'Аванс';
    if (value.startsWith(SALARY_PAYMENT_PREFIX)) return 'Зарплата';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'аванс') return 'Аванс';
    if (normalized === 'зарплата') return 'Зарплата';
    if (normalized === 'премия') return 'Премия';
    return value;
};

const displayPaymentKind = (value: string | null): string | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'advance') return 'Аванс';
    if (normalized === 'salary' || normalized === 'salary_cycle') return 'Зарплата';
    if (normalized === 'vacation') return 'Отпускные';
    if (normalized === 'bonus') return 'Премия';
    return value;
};

const resolvePaymentKindCode = (paymentType: string | null): 'advance' | 'salary' | 'vacation' | 'bonus' => {
    const normalized = String(paymentType || '').trim().toLowerCase();
    if (normalized.startsWith(ADVANCE_PAYMENT_PREFIX) || normalized === 'аванс') return 'advance';
    if (normalized.startsWith(VACATION_PAYMENT_PREFIX) || normalized === 'отпускные') return 'vacation';
    if (normalized === 'премия' || normalized === 'bonus') return 'bonus';
    return 'salary';
};

const suggestionSortValue = (value: FinanceSuggestedPayment): number => {
    const typeRank =
        value.type === 'salary_cycle' ? 3 :
        value.type === 'advance' ? 2 :
        value.type === 'vacation' ? 1 :
        0;
    return new Date(value.recommendedDate).getTime() * 10 + typeRank;
};

const pickPrimarySuggestion = (items: FinanceSuggestedPayment[]): FinanceSuggestedPayment | null => {
    if (!items.length) return null;
    return items.reduce((best, item) => {
        if (!best) return item;
        return suggestionSortValue(item) > suggestionSortValue(best) ? item : best;
    }, null as FinanceSuggestedPayment | null);
};

const isVacationStatusActive = (value: unknown): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return !['cancelled', 'canceled', 'отменен', 'отменена', 'rejected', 'declined'].includes(normalized);
};

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

const ensurePaymentsSchema = async (tableName: string) => {
    if (!(await hasTable(tableName))) return;

    await query(`
        ALTER TABLE public.${quoteIdent(tableName)}
        ADD COLUMN IF NOT EXISTS "статус" character varying(50),
        ADD COLUMN IF NOT EXISTS "комментарий" text,
        ADD COLUMN IF NOT EXISTS "начислено" numeric(12, 2),
        ADD COLUMN IF NOT EXISTS "удержано" numeric(12, 2),
        ADD COLUMN IF NOT EXISTS "выплачено" numeric(12, 2),
        ADD COLUMN IF NOT EXISTS "к_выплате" numeric(12, 2),
        ADD COLUMN IF NOT EXISTS "вид_выплаты" character varying(50),
        ADD COLUMN IF NOT EXISTS "период_с" date,
        ADD COLUMN IF NOT EXISTS "период_по" date,
        ADD COLUMN IF NOT EXISTS "расчет" jsonb
    `);
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
            accruedCol: null,
            withheldCol: null,
            paidCol: null,
            payableCol: null,
            paymentKindCol: null,
            periodFromCol: null,
            periodToCol: null,
            calculationCol: null,
        };
    }

    await ensurePaymentsSchema(paymentsTableName);

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
        accruedCol: pickCol(cols, ['начислено', 'accrued_amount']),
        withheldCol: pickCol(cols, ['удержано', 'withheld_amount']),
        paidCol: pickCol(cols, ['выплачено', 'paid_amount']),
        payableCol: pickCol(cols, ['к_выплате', 'payable_amount']),
        paymentKindCol: pickCol(cols, ['вид_выплаты', 'payment_kind']),
        periodFromCol: pickCol(cols, ['период_с', 'period_from']),
        periodToCol: pickCol(cols, ['период_по', 'period_to']),
        calculationCol: pickCol(cols, ['расчет', 'calculation']),
    };
};

export const getFinancePayload = async (monthsRequested: number): Promise<FinanceResponse> => {
    const settings = await getSettings();
    const today = parseDateOnly(new Date()) || new Date();

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
        currentAccrued: 0,
        currentWithheld: 0,
        currentPaid: 0,
        currentPayable: 0,
        suggestedPayments: [],
        paymentHistory: [],
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

    const historySelectFields = [
        `в.${quoteIdent(paymentsMeta.idCol)}::text AS id`,
        `в.${quoteIdent(paymentsMeta.employeeCol)}::int AS employee_id`,
        `в.${quoteIdent(paymentsMeta.amountCol)}::numeric AS amount`,
        `в.${quoteIdent(paymentsMeta.dateCol)} AS payment_date`,
        `${paymentsMeta.typeCol ? `в.${quoteIdent(paymentsMeta.typeCol)}::text` : 'NULL::text'} AS payment_type`,
        `${paymentsMeta.statusCol ? `в.${quoteIdent(paymentsMeta.statusCol)}::text` : 'NULL::text'} AS payment_status`,
        `${paymentsMeta.commentCol ? `в.${quoteIdent(paymentsMeta.commentCol)}::text` : 'NULL::text'} AS payment_comment`,
        `${paymentsMeta.accruedCol ? `в.${quoteIdent(paymentsMeta.accruedCol)}::numeric` : 'NULL::numeric'} AS payment_accrued`,
        `${paymentsMeta.withheldCol ? `в.${quoteIdent(paymentsMeta.withheldCol)}::numeric` : 'NULL::numeric'} AS payment_withheld`,
        `${paymentsMeta.paidCol ? `в.${quoteIdent(paymentsMeta.paidCol)}::numeric` : 'NULL::numeric'} AS payment_paid`,
        `${paymentsMeta.payableCol ? `в.${quoteIdent(paymentsMeta.payableCol)}::numeric` : 'NULL::numeric'} AS payment_payable`,
        `${paymentsMeta.paymentKindCol ? `в.${quoteIdent(paymentsMeta.paymentKindCol)}::text` : 'NULL::text'} AS payment_kind`,
        `${paymentsMeta.periodFromCol ? `в.${quoteIdent(paymentsMeta.periodFromCol)}` : 'NULL::date'} AS payment_period_from`,
        `${paymentsMeta.periodToCol ? `в.${quoteIdent(paymentsMeta.periodToCol)}` : 'NULL::date'} AS payment_period_to`,
        `${paymentsMeta.calculationCol ? `в.${quoteIdent(paymentsMeta.calculationCol)}` : 'NULL::jsonb'} AS payment_calculation`,
        `с."фио" AS employee_name`,
    ];

    const paymentHistoryRes = await query(
        `
        SELECT ${historySelectFields.join(', ')}
        FROM public.${quoteIdent(paymentsMeta.tableName)} в
        LEFT JOIN public."Сотрудники" с ON с.id = в.${quoteIdent(paymentsMeta.employeeCol)}
        WHERE в.${quoteIdent(paymentsMeta.dateCol)} IS NOT NULL
        ORDER BY в.${quoteIdent(paymentsMeta.dateCol)} DESC, в.${quoteIdent(paymentsMeta.idCol)} DESC
        LIMIT 500
        `
    );

    const allPayments: FinancePayment[] = (paymentHistoryRes.rows || []).map((row: any) => ({
        id: String(row.id),
        employeeId: row.employee_id == null ? null : Number(row.employee_id),
        employeeName: row.employee_name == null ? null : String(row.employee_name),
        amount: Number(row.amount) || 0,
        date: row.payment_date == null ? '' : String(row.payment_date),
        type: displayPaymentType(normalizePaymentType(row.payment_type)),
        status: normalizeOptionalText(row.payment_status) || 'Выплачено',
        comment: normalizeOptionalText(row.payment_comment),
        accruedAmount: Number(row.payment_accrued) || 0,
        withheldAmount: Number(row.payment_withheld) || 0,
        paidAmount: Number(row.payment_paid) || Number(row.amount) || 0,
        payableAmount: Number(row.payment_payable) || 0,
        paymentKind: displayPaymentKind(normalizeOptionalText(row.payment_kind)),
        periodFrom: row.payment_period_from == null ? null : String(row.payment_period_from),
        periodTo: row.payment_period_to == null ? null : String(row.payment_period_to),
        calculation: row.payment_calculation && typeof row.payment_calculation === 'object'
            ? row.payment_calculation
            : null,
    }));

    const rawPaymentsByEmployee = new Map<number, Array<{ date: Date; rawType: string | null; paidAmount: number; accruedAmount: number; withheldAmount: number }>>();
    const paymentHistoryByEmployee = new Map<number, FinancePayment[]>();
    allPayments.forEach((payment, index) => {
        const employeeId = payment.employeeId;
        const paymentDate = parseDateOnly(payment.date);
        if (!employeeId || !paymentDate) return;

        const sourceRow: any = paymentHistoryRes.rows?.[index] || {};
        const bucket = rawPaymentsByEmployee.get(employeeId) || [];
        bucket.push({
            date: paymentDate,
            rawType: normalizePaymentType(sourceRow.payment_type),
            paidAmount: payment.paidAmount,
            accruedAmount: payment.accruedAmount,
            withheldAmount: payment.withheldAmount,
        });
        rawPaymentsByEmployee.set(employeeId, bucket);

        const historyBucket = paymentHistoryByEmployee.get(employeeId) || [];
        historyBucket.push(payment);
        paymentHistoryByEmployee.set(employeeId, historyBucket);
    });

    const vacationRes = await query(
        `
        SELECT
            id,
            employee_id,
            date_from,
            date_to,
            status,
            vacation_type
        FROM public.employee_vacations
        WHERE date_to >= $1
        ORDER BY date_from ASC, id ASC
        `,
        [formatDateOnly(addMonths(startOfMonth(today), -monthsRequested))]
    );

    const vacationsByEmployee = new Map<number, Array<{
        id: number;
        dateFrom: Date;
        dateTo: Date;
        status: string | null;
        vacationType: string | null;
    }>>();

    for (const row of vacationRes.rows || []) {
        const employeeId = Number(row.employee_id);
        const dateFrom = parseDateOnly(row.date_from);
        const dateTo = parseDateOnly(row.date_to);
        if (!employeeId || !dateFrom || !dateTo || !isVacationStatusActive(row.status)) continue;

        const bucket = vacationsByEmployee.get(employeeId) || [];
        bucket.push({
            id: Number(row.id),
            dateFrom,
            dateTo,
            status: row.status == null ? null : String(row.status),
            vacationType: row.vacation_type == null ? null : String(row.vacation_type),
        });
        vacationsByEmployee.set(employeeId, bucket);
    }

    const duePayrollCycles = (() => {
        const cyclePeriodStart = addMonths(startOfMonth(today), -2);
        const paymentDates = enumeratePaymentDates(settings, cyclePeriodStart, today).filter((date) => date <= today);
        if (paymentDates.length < 2) {
            return [] as Array<{
                key: string;
                payDate: Date;
                dateFrom: Date;
                dateTo: Date;
                type: 'advance' | 'salary_cycle';
            }>;
        }

        return paymentDates.slice(1).map((payDate, index) => {
            const previousPayDate = paymentDates[index];
            const monthDates = paymentDates
                .filter((date) => date.getUTCFullYear() === payDate.getUTCFullYear() && date.getUTCMonth() === payDate.getUTCMonth())
                .sort((a, b) => a.getTime() - b.getTime());
            const isAdvance = settings.paymentsPerMonth === 2 && monthDates[0] && formatDateOnly(monthDates[0]) === formatDateOnly(payDate);
            const type: 'advance' | 'salary_cycle' = isAdvance ? 'advance' : 'salary_cycle';

            return {
                key: `${type === 'advance' ? ADVANCE_PAYMENT_PREFIX : SALARY_PAYMENT_PREFIX}${formatDateOnly(payDate)}`,
                payDate,
                dateFrom: addDays(previousPayDate, 1),
                dateTo: payDate,
                type,
            };
        });
    })();

    const employeesWithSuggestions = mergedEmployees.map((employee) => {
        const suggestedPayments: FinanceSuggestedPayment[] = [];
        const employeePayments = rawPaymentsByEmployee.get(employee.id) || [];
        const employeeVacations = vacationsByEmployee.get(employee.id) || [];
        const vacationDays = new Set<string>();

        for (const vacation of employeeVacations) {
            for (const day of enumerateDays(vacation.dateFrom, vacation.dateTo)) {
                vacationDays.add(formatDateOnly(day));
            }
        }

        if (employee.rate && employee.rate > 0) {
            for (const cycle of duePayrollCycles) {
                const alreadyPaid = employeePayments.some((payment) =>
                    payment.rawType === cycle.key ||
                    (cycle.type === 'advance' && payment.rawType === 'аванс' && formatDateOnly(payment.date) === formatDateOnly(cycle.payDate)) ||
                    (cycle.type === 'salary_cycle' && payment.rawType === 'зарплата' && formatDateOnly(payment.date) === formatDateOnly(cycle.payDate))
                );

                if (alreadyPaid) continue;

                const payableDays = enumerateDays(cycle.dateFrom, cycle.dateTo).filter((day) => !vacationDays.has(formatDateOnly(day)));
                const accruedAmount = roundMoney(computeCalendarAmount(employee.rate, payableDays));
                if (accruedAmount <= 0) continue;
                const withheldAmount = computeWithholdingAmount(accruedAmount);
                const payableAmount = computeNetAmount(accruedAmount, withheldAmount);

                suggestedPayments.push({
                    key: cycle.key,
                    type: cycle.type,
                    encodedType: cycle.key,
                    label: `${cycle.type === 'advance' ? 'Аванс' : 'Зарплата'} за период ${formatDateOnly(cycle.dateFrom)} - ${formatDateOnly(cycle.dateTo)}`,
                    amount: payableAmount,
                    accruedAmount,
                    withheldAmount,
                    paidAmount: 0,
                    payableAmount,
                    recommendedDate: formatDateOnly(cycle.payDate),
                    periodFrom: formatDateOnly(cycle.dateFrom),
                    periodTo: formatDateOnly(cycle.dateTo),
                    note: `Период без дней отпуска, дата выплаты по графику: ${formatDateOnly(cycle.payDate)}.`,
                    sourceSummary: `${cycle.type === 'advance' ? 'Первый платеж месяца (аванс)' : 'Основная зарплата по графику'} · НДФЛ ${roundMoney(DEFAULT_TAX_RATE * 100)}%`,
                });
            }

            for (const vacation of employeeVacations) {
                const dueDate = addDays(vacation.dateFrom, -14);
                if (dueDate > today) continue;

                const encodedType = `${VACATION_PAYMENT_PREFIX}${vacation.id}`;
                const alreadyPaid = employeePayments.some((payment) => payment.rawType === encodedType);
                if (alreadyPaid) continue;

                const vacationDaysList = enumerateDays(vacation.dateFrom, vacation.dateTo);
                const accruedAmount = roundMoney(computeCalendarAmount(employee.rate, vacationDaysList));
                if (accruedAmount <= 0) continue;
                const withheldAmount = computeWithholdingAmount(accruedAmount);
                const payableAmount = computeNetAmount(accruedAmount, withheldAmount);

                suggestedPayments.push({
                    key: encodedType,
                    type: 'vacation',
                    encodedType,
                    label: `Отпускные за период ${formatDateOnly(vacation.dateFrom)} - ${formatDateOnly(vacation.dateTo)}`,
                    amount: payableAmount,
                    accruedAmount,
                    withheldAmount,
                    paidAmount: 0,
                    payableAmount,
                    recommendedDate: formatDateOnly(dueDate),
                    periodFrom: formatDateOnly(vacation.dateFrom),
                    periodTo: formatDateOnly(vacation.dateTo),
                    note: `Начислить не позднее ${formatDateOnly(vacation.dateFrom)}. Дни отпуска исключаются из обычной зарплаты.`,
                    sourceSummary: 'Отпуск по кадровому графику · НДФЛ 13%',
                });
            }
        }

        suggestedPayments.sort((a, b) => {
            const dateDiff = String(a.recommendedDate).localeCompare(String(b.recommendedDate));
            if (dateDiff !== 0) return dateDiff;
            if (a.type !== b.type) return a.type === 'vacation' ? -1 : 1;
            return a.label.localeCompare(b.label, 'ru');
        });

        const primarySuggestion = pickPrimarySuggestion(suggestedPayments);

        return {
            ...employee,
            currentAccrued: primarySuggestion?.accruedAmount || 0,
            currentWithheld: primarySuggestion?.withheldAmount || 0,
            currentPaid: roundMoney(employeePayments
                .filter((payment) => payment.date.getUTCFullYear() === today.getUTCFullYear() && payment.date.getUTCMonth() === today.getUTCMonth())
                .reduce((sum, payment) => sum + payment.paidAmount, 0)),
            currentPayable: primarySuggestion?.payableAmount || 0,
            suggestedPayments,
            paymentHistory: (paymentHistoryByEmployee.get(employee.id) || []).slice(0, 12),
        };
    });

    const recentPayments = allPayments.slice(0, 30);

    return {
        settings,
        paymentTableAvailable: true,
        employees: employeesWithSuggestions,
        recentPayments,
        totals: {
            activeEmployees: employeesWithSuggestions.filter((employee) => employee.active).length,
            totalPaid: employeesWithSuggestions.reduce((sum, employee) => sum + employee.totalPaid, 0),
            paymentCount: employeesWithSuggestions.reduce((sum, employee) => sum + employee.paymentCount, 0),
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
            const paymentType = typeof body.paymentType === 'string' && body.paymentType.trim()
                ? body.paymentType.trim()
                : 'зарплата';

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

            const payload = await getFinancePayload(6);
            const employee = payload.employees.find((item) => item.id === employeeId) || null;
            const suggestion = employee?.suggestedPayments.find((item) => item.encodedType === paymentType) || null;
            const paymentKind = resolvePaymentKindCode(paymentType);
            const accruedAmount = suggestion?.accruedAmount ?? amount;
            const withheldAmount = suggestion?.withheldAmount ?? 0;
            const paidAmount = amount;
            const payableAmount = 0;
            const periodFrom = suggestion?.periodFrom ?? null;
            const periodTo = suggestion?.periodTo ?? null;
            const calculation = {
                source: suggestion?.sourceSummary || 'Ручная выплата',
                label: suggestion?.label || displayPaymentType(paymentType) || 'Выплата',
                note: suggestion?.note || null,
                gross: accruedAmount,
                withheld: withheldAmount,
                paid: paidAmount,
                payable: payableAmount,
                periodFrom,
                periodTo,
                paymentKind,
                paymentDate,
            };

            const columns = [quoteIdent(paymentsMeta.employeeCol), quoteIdent(paymentsMeta.amountCol), quoteIdent(paymentsMeta.dateCol)];
            const values: any[] = [employeeId, amount, paymentDate];

            if (paymentsMeta.typeCol) {
                columns.push(quoteIdent(paymentsMeta.typeCol));
                values.push(paymentType);
            }

            if (paymentsMeta.statusCol) {
                columns.push(quoteIdent(paymentsMeta.statusCol));
                values.push('выплачено');
            }

            if (paymentsMeta.commentCol && comment) {
                columns.push(quoteIdent(paymentsMeta.commentCol));
                values.push(comment);
            }

            if (paymentsMeta.accruedCol) {
                columns.push(quoteIdent(paymentsMeta.accruedCol));
                values.push(accruedAmount);
            }

            if (paymentsMeta.withheldCol) {
                columns.push(quoteIdent(paymentsMeta.withheldCol));
                values.push(withheldAmount);
            }

            if (paymentsMeta.paidCol) {
                columns.push(quoteIdent(paymentsMeta.paidCol));
                values.push(paidAmount);
            }

            if (paymentsMeta.payableCol) {
                columns.push(quoteIdent(paymentsMeta.payableCol));
                values.push(payableAmount);
            }

            if (paymentsMeta.paymentKindCol) {
                columns.push(quoteIdent(paymentsMeta.paymentKindCol));
                values.push(paymentKind);
            }

            if (paymentsMeta.periodFromCol && periodFrom) {
                columns.push(quoteIdent(paymentsMeta.periodFromCol));
                values.push(periodFrom);
            }

            if (paymentsMeta.periodToCol && periodTo) {
                columns.push(quoteIdent(paymentsMeta.periodToCol));
                values.push(periodTo);
            }

            if (paymentsMeta.calculationCol) {
                columns.push(quoteIdent(paymentsMeta.calculationCol));
                values.push(JSON.stringify(calculation));
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

        if (req.method === 'POST' && action === 'bulk-payroll-today') {
            const paymentDate = new Date().toISOString().slice(0, 10);
            const defaultComment = typeof body.comment === 'string' && body.comment.trim()
                ? body.comment.trim()
                : 'Массовая выплата по графику';

            const paymentsMeta = await getPaymentsMeta();
            if (!paymentsMeta.exists || !paymentsMeta.employeeCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
                return res.status(400).json({ error: 'Таблица выплат недоступна для записи' });
            }

            const payload = await getFinancePayload(6);
            const employeesToPay = payload.employees
                .filter((employee) => employee.active)
                .map((employee) => ({
                    employee,
                    suggestion: pickPrimarySuggestion(
                        employee.suggestedPayments.filter((item) => item.type === 'advance' || item.type === 'salary_cycle')
                    ),
                }))
                .filter((item) => item.suggestion && item.suggestion.amount > 0);

            if (!employeesToPay.length) {
                return res.status(400).json({ error: 'Нет сотрудников с начислениями к выплате по графику на сегодня' });
            }

            await query('BEGIN');
            try {
                for (const item of employeesToPay) {
                    const suggestion = item.suggestion!;
                    const columns = [quoteIdent(paymentsMeta.employeeCol), quoteIdent(paymentsMeta.amountCol), quoteIdent(paymentsMeta.dateCol)];
                    const values: any[] = [item.employee.id, suggestion.amount, paymentDate];

                    if (paymentsMeta.typeCol) {
                        columns.push(quoteIdent(paymentsMeta.typeCol));
                        values.push(suggestion.encodedType);
                    }

                    if (paymentsMeta.statusCol) {
                        columns.push(quoteIdent(paymentsMeta.statusCol));
                        values.push('выплачено');
                    }

                    if (paymentsMeta.commentCol) {
                        columns.push(quoteIdent(paymentsMeta.commentCol));
                        values.push(defaultComment);
                    }

                    if (paymentsMeta.accruedCol) {
                        columns.push(quoteIdent(paymentsMeta.accruedCol));
                        values.push(suggestion.accruedAmount);
                    }

                    if (paymentsMeta.withheldCol) {
                        columns.push(quoteIdent(paymentsMeta.withheldCol));
                        values.push(suggestion.withheldAmount);
                    }

                    if (paymentsMeta.paidCol) {
                        columns.push(quoteIdent(paymentsMeta.paidCol));
                        values.push(suggestion.amount);
                    }

                    if (paymentsMeta.payableCol) {
                        columns.push(quoteIdent(paymentsMeta.payableCol));
                        values.push(0);
                    }

                    if (paymentsMeta.paymentKindCol) {
                        columns.push(quoteIdent(paymentsMeta.paymentKindCol));
                        values.push(resolvePaymentKindCode(suggestion.encodedType));
                    }

                    if (paymentsMeta.periodFromCol && suggestion.periodFrom) {
                        columns.push(quoteIdent(paymentsMeta.periodFromCol));
                        values.push(suggestion.periodFrom);
                    }

                    if (paymentsMeta.periodToCol && suggestion.periodTo) {
                        columns.push(quoteIdent(paymentsMeta.periodToCol));
                        values.push(suggestion.periodTo);
                    }

                    if (paymentsMeta.calculationCol) {
                        columns.push(quoteIdent(paymentsMeta.calculationCol));
                        values.push(JSON.stringify({
                            source: suggestion.sourceSummary || 'Массовая выплата',
                            label: suggestion.label,
                            note: suggestion.note,
                            gross: suggestion.accruedAmount,
                            withheld: suggestion.withheldAmount,
                            paid: suggestion.amount,
                            payable: 0,
                            periodFrom: suggestion.periodFrom,
                            periodTo: suggestion.periodTo,
                            paymentKind: resolvePaymentKindCode(suggestion.encodedType),
                            paymentDate,
                        }));
                    }

                    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                    await query(
                        `
                        INSERT INTO public.${quoteIdent(paymentsMeta.tableName)} (${columns.join(', ')})
                        VALUES (${placeholders})
                        `,
                        values
                    );
                }

                await query('COMMIT');
            } catch (bulkError) {
                await query('ROLLBACK');
                throw bulkError;
            }

            return res.status(200).json({ ok: true });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    } catch (error) {
        console.error('Finance admin API error:', error);
        return res.status(500).json({ error: 'Ошибка финансового модуля' });
    }
}
