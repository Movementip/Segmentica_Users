import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

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
    currentOrgDebt: number;
    currentEmployeeDebt: number;
    currentContributions: number;
    currentContributionDetails: {
        taxableIncomeMonth: number;
        contributionBaseMonth: number;
        contributionYearBase30: number;
        contributionYearBase151: number;
    };
    currentBreakdown: {
        advance: number;
        salary: number;
        vacation: number;
        bonus: number;
        sickLeave: number;
    };
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

export type FinanceSuggestedPaymentType =
    | 'advance'
    | 'salary_cycle'
    | 'vacation'
    | 'bonus'
    | 'sick_leave';

export type FinancePaymentKindCode =
    | 'advance'
    | 'salary'
    | 'vacation'
    | 'bonus'
    | 'sick_leave';

export type FinanceSuggestedPayment = {
    key: string;
    type: FinanceSuggestedPaymentType;
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
    selectedMonth: string;
    selectedMonthLabel: string;
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
const SICK_LEAVE_PAYMENT_PREFIX = 'больничный#';
const OPEN_PAYMENT_PREFIX = 'open-payment#';
const DEFAULT_TAX_RATE = 0.13;
const CONTRIBUTION_THRESHOLD = 2_979_000;
const CONTRIBUTION_RATE_BASE = 0.3;
const CONTRIBUTION_RATE_ABOVE = 0.151;
const SICK_SCHEDULE_STATUSES = new Set(['больничный', 'больничный лист']);

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

const parseMonthKey = (value: unknown): Date | null => {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(normalized)) return null;

    const [yearRaw, monthRaw] = normalized.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return new Date(Date.UTC(year, month - 1, 1));
};

const formatMonthKey = (value: Date): string => {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const formatMonthLabel = (value: Date): string =>
    {
        const label = value.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
        });
        return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : formatMonthKey(value);
    };

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

const normalizePaymentKindCode = (value: unknown): FinancePaymentKindCode | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.startsWith(ADVANCE_PAYMENT_PREFIX) || normalized === 'аванс' || normalized === 'advance') return 'advance';
    if (
        normalized.startsWith(VACATION_PAYMENT_PREFIX)
        || normalized === 'отпускные'
        || normalized === 'vacation'
    ) return 'vacation';
    if (
        normalized.startsWith(SICK_LEAVE_PAYMENT_PREFIX)
        || normalized === 'больничный'
        || normalized === 'больничные'
        || normalized === 'sick_leave'
        || normalized === 'sick'
    ) return 'sick_leave';
    if (normalized === 'премия' || normalized === 'bonus') return 'bonus';
    if (
        normalized.startsWith(SALARY_PAYMENT_PREFIX)
        || normalized === 'зарплата'
        || normalized === 'salary'
        || normalized === 'salary_cycle'
    ) return 'salary';
    return null;
};

const financePaymentKindToSuggestionType = (paymentKind: FinancePaymentKindCode): FinanceSuggestedPaymentType =>
    paymentKind === 'salary' ? 'salary_cycle' : paymentKind;

const getSuggestedPaymentTypeLabel = (type: FinanceSuggestedPaymentType): string => {
    if (type === 'advance') return 'Аванс';
    if (type === 'vacation') return 'Отпускные';
    if (type === 'bonus') return 'Премия';
    if (type === 'sick_leave') return 'Больничный';
    return 'Зарплата';
};

const displayPaymentType = (value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith(VACATION_PAYMENT_PREFIX)) return 'Отпускные';
    if (value.startsWith(ADVANCE_PAYMENT_PREFIX)) return 'Аванс';
    if (value.startsWith(SALARY_PAYMENT_PREFIX)) return 'Зарплата';
    if (value.startsWith(SICK_LEAVE_PAYMENT_PREFIX)) return 'Больничный';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'аванс') return 'Аванс';
    if (normalized === 'зарплата') return 'Зарплата';
    if (normalized === 'премия') return 'Премия';
    if (normalized === 'больничный' || normalized === 'больничные' || normalized === 'sick_leave') return 'Больничный';
    return value;
};

const displayPaymentKind = (value: string | null): string | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'advance') return 'Аванс';
    if (normalized === 'salary' || normalized === 'salary_cycle') return 'Зарплата';
    if (normalized === 'vacation') return 'Отпускные';
    if (normalized === 'bonus') return 'Премия';
    if (normalized === 'sick_leave') return 'Больничный';
    return value;
};

const resolvePaymentKindCode = (paymentType: string | null): FinancePaymentKindCode =>
    normalizePaymentKindCode(paymentType) || 'salary';

const getSuggestedPaymentPriority = (type: FinanceSuggestedPaymentType): number => {
    if (type === 'vacation') return 0;
    if (type === 'sick_leave') return 1;
    if (type === 'advance') return 2;
    if (type === 'salary_cycle') return 3;
    return 4;
};

const suggestionSortValue = (value: FinanceSuggestedPayment): number => {
    return new Date(value.recommendedDate).getTime() * 10 + getSuggestedPaymentPriority(value.type);
};

const pickPrimarySuggestion = (items: FinanceSuggestedPayment[]): FinanceSuggestedPayment | null => {
    if (!items.length) return null;
    return items.reduce((best, item) => {
        if (!best) return item;
        return suggestionSortValue(item) < suggestionSortValue(best) ? item : best;
    }, null as FinanceSuggestedPayment | null);
};

const isVacationStatusActive = (value: unknown): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return !['cancelled', 'canceled', 'отменен', 'отменена', 'rejected', 'declined'].includes(normalized);
};

const isSickScheduleStatus = (value: unknown): boolean =>
    SICK_SCHEDULE_STATUSES.has(String(value || '').trim().toLowerCase());

const calculatePaymentBalance = (payment: Pick<FinancePayment, 'accruedAmount' | 'withheldAmount' | 'paidAmount' | 'payableAmount' | 'amount'>): number => {
    const explicitPayable = Number(payment.payableAmount || 0);
    if (Math.abs(explicitPayable) > 0.009) return roundMoney(explicitPayable);

    const gross = Number(payment.accruedAmount || 0);
    const withheld = Number(payment.withheldAmount || 0);
    const paid = Number(payment.paidAmount || payment.amount || 0);
    if (gross > 0 || withheld > 0) {
        return roundMoney(gross - withheld - paid);
    }

    return 0;
};

const getPaymentAccruedAmount = (payment: {
    paymentKind: FinancePaymentKindCode | null;
    accruedAmount: number;
    paidAmount: number;
    amount?: number;
}): number => {
    const explicitAccrued = Number(payment.accruedAmount || 0);
    if (explicitAccrued > 0) return explicitAccrued;

    const fallbackPaid = Number(payment.paidAmount || payment.amount || 0);
    if (payment.paymentKind === 'bonus' || payment.paymentKind === 'sick_leave' || payment.paymentKind === 'vacation' || payment.paymentKind === 'salary' || payment.paymentKind === 'advance') {
        return fallbackPaid;
    }

    return fallbackPaid;
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

const settleOpenPaymentRecord = async (
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    paymentsMeta: Awaited<ReturnType<typeof getPaymentsMeta>>,
    params: {
        paymentId: string;
        amount: number;
        paymentDate: string;
        comment: string;
    }
) => {
    if (!paymentsMeta.idCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
        throw new Error('Таблица выплат недоступна для обновления открытого начисления');
    }

    const sets = [
        `${quoteIdent(paymentsMeta.amountCol)} = COALESCE(${quoteIdent(paymentsMeta.amountCol)}, 0) + $2`,
        `${quoteIdent(paymentsMeta.dateCol)} = $3`,
    ];
    const values: any[] = [params.paymentId, params.amount, params.paymentDate];

    if (paymentsMeta.paidCol) {
        sets.push(`${quoteIdent(paymentsMeta.paidCol)} = COALESCE(${quoteIdent(paymentsMeta.paidCol)}, 0) + $2`);
    }

    if (paymentsMeta.payableCol) {
        sets.push(`${quoteIdent(paymentsMeta.payableCol)} = GREATEST(COALESCE(${quoteIdent(paymentsMeta.payableCol)}, 0) - $2, 0)`);
    }

    if (paymentsMeta.statusCol) {
        sets.push(
            `${quoteIdent(paymentsMeta.statusCol)} = CASE
                WHEN ${paymentsMeta.payableCol ? `GREATEST(COALESCE(${quoteIdent(paymentsMeta.payableCol)}, 0) - $2, 0)` : '0'} <= 0.009
                    THEN 'выплачено'
                ELSE 'частично выплачено'
            END`
        );
    }

    if (paymentsMeta.commentCol && params.comment) {
        values.push(params.comment);
        sets.push(`${quoteIdent(paymentsMeta.commentCol)} = COALESCE(${quoteIdent(paymentsMeta.commentCol)}, '') || CASE WHEN COALESCE(${quoteIdent(paymentsMeta.commentCol)}, '') = '' THEN $4 ELSE E'\\n' || $4 END`);
    }

    await executor.query(
        `
        UPDATE public.${quoteIdent(paymentsMeta.tableName)}
        SET ${sets.join(', ')}
        WHERE ${quoteIdent(paymentsMeta.idCol)}::text = $1
        `,
        values
    );
};

export const getFinancePayload = async (monthsRequested: number, monthKey?: string | null): Promise<FinanceResponse> => {
    const settings = await getSettings();
    const today = parseDateOnly(new Date()) || new Date();
    const selectedMonthDate = parseMonthKey(monthKey) || startOfMonth(today);
    const selectedMonthStart = startOfMonth(selectedMonthDate);
    const selectedMonthEnd = endOfMonth(selectedMonthDate);
    const historyWindowStart = addMonths(startOfMonth(selectedMonthDate), -(monthsRequested - 1));

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
        currentOrgDebt: 0,
        currentEmployeeDebt: 0,
        currentContributions: 0,
        currentContributionDetails: {
            taxableIncomeMonth: 0,
            contributionBaseMonth: 0,
            contributionYearBase30: 0,
            contributionYearBase151: 0,
        },
        currentBreakdown: {
            advance: 0,
            salary: 0,
            vacation: 0,
            bonus: 0,
            sickLeave: 0,
        },
        suggestedPayments: [],
        paymentHistory: [],
    }));

    const paymentsMeta = await getPaymentsMeta();
    if (!paymentsMeta.exists || !paymentsMeta.idCol || !paymentsMeta.employeeCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
        return {
            settings,
            paymentTableAvailable: false,
            selectedMonth: formatMonthKey(selectedMonthDate),
            selectedMonthLabel: formatMonthLabel(selectedMonthDate),
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
          AND ${quoteIdent(paymentsMeta.dateCol)} >= $1::date
          AND ${quoteIdent(paymentsMeta.dateCol)} <= $2::date
        GROUP BY ${quoteIdent(paymentsMeta.employeeCol)}
        `,
        [formatDateOnly(historyWindowStart), formatDateOnly(selectedMonthEnd)]
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

    const rawPaymentsByEmployee = new Map<number, Array<{
        id: string;
        date: Date;
        rawType: string | null;
        rawStatus: string | null;
        rawComment: string | null;
        paymentKind: FinancePaymentKindCode | null;
        paidAmount: number;
        accruedAmount: number;
        withheldAmount: number;
        payableAmount: number;
        periodFrom: string | null;
        periodTo: string | null;
        calculation: Record<string, any> | null;
    }>>();
    const paymentHistoryByEmployee = new Map<number, FinancePayment[]>();
    allPayments.forEach((payment, index) => {
        const employeeId = payment.employeeId;
        const paymentDate = parseDateOnly(payment.date);
        if (!employeeId || !paymentDate) return;

        const sourceRow: any = paymentHistoryRes.rows?.[index] || {};
        const bucket = rawPaymentsByEmployee.get(employeeId) || [];
        const rawType = normalizePaymentType(sourceRow.payment_type);
        const rawKind = normalizeOptionalText(sourceRow.payment_kind)
            || normalizeOptionalText(sourceRow.payment_calculation?.paymentKind)
            || rawType;
        bucket.push({
            id: payment.id,
            date: paymentDate,
            rawType,
            rawStatus: normalizeOptionalText(sourceRow.payment_status),
            rawComment: normalizeOptionalText(sourceRow.payment_comment),
            paymentKind: normalizePaymentKindCode(rawKind),
            paidAmount: payment.paidAmount,
            accruedAmount: payment.accruedAmount,
            withheldAmount: payment.withheldAmount,
            payableAmount: payment.payableAmount,
            periodFrom: payment.periodFrom,
            periodTo: payment.periodTo,
            calculation: payment.calculation,
        });
        rawPaymentsByEmployee.set(employeeId, bucket);

        const historyBucket = paymentHistoryByEmployee.get(employeeId) || [];
        historyBucket.push(payment);
        paymentHistoryByEmployee.set(employeeId, historyBucket);
    });

    const sickScheduleRes = await query(
        `
        SELECT
            "сотрудник_id" AS employee_id,
            "дата" AS work_date,
            "статус" AS work_status
        FROM public."График_работы"
        WHERE "дата" >= $1
          AND "дата" <= $2
        ORDER BY "сотрудник_id" ASC, "дата" ASC
        `,
        [formatDateOnly(addMonths(startOfMonth(selectedMonthStart), -2)), formatDateOnly(selectedMonthEnd)]
    ).catch(() => ({ rows: [] as any[] }));

    const sickDaysByEmployee = new Map<number, Set<string>>();
    for (const row of sickScheduleRes.rows || []) {
        const employeeId = Number(row.employee_id);
        const workDate = parseDateOnly(row.work_date);
        if (!employeeId || !workDate || !isSickScheduleStatus(row.work_status)) continue;
        const bucket = sickDaysByEmployee.get(employeeId) || new Set<string>();
        bucket.add(formatDateOnly(workDate));
        sickDaysByEmployee.set(employeeId, bucket);
    }

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
        [formatDateOnly(addMonths(startOfMonth(selectedMonthStart), -2))]
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
        const cyclePeriodStart = addMonths(startOfMonth(selectedMonthStart), -2);
        const paymentDates = enumeratePaymentDates(settings, cyclePeriodStart, selectedMonthEnd);
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
        }).filter((cycle) => cycle.payDate >= selectedMonthStart && cycle.payDate <= selectedMonthEnd);
    })();

    const employeesWithSuggestions = mergedEmployees.map((employee) => {
        const suggestedPayments: FinanceSuggestedPayment[] = [];
        const employeePayments = rawPaymentsByEmployee.get(employee.id) || [];
        const employeeVacations = vacationsByEmployee.get(employee.id) || [];
        const vacationDays = new Set<string>();
        const sickDays = new Set(sickDaysByEmployee.get(employee.id) || []);

        for (const vacation of employeeVacations) {
            for (const day of enumerateDays(vacation.dateFrom, vacation.dateTo)) {
                vacationDays.add(formatDateOnly(day));
            }
        }

        if (employee.rate && employee.rate > 0) {
            for (const cycle of duePayrollCycles) {
                const alreadyPaid = employeePayments.some((payment) =>
                    payment.rawType === cycle.key
                    || (
                        cycle.type === 'advance'
                        && payment.paymentKind === 'advance'
                        && formatDateOnly(payment.date) === formatDateOnly(cycle.payDate)
                    )
                    || (
                        cycle.type === 'salary_cycle'
                        && payment.paymentKind === 'salary'
                        && formatDateOnly(payment.date) === formatDateOnly(cycle.payDate)
                    )
                );

                if (alreadyPaid) continue;

                const cycleDays = enumerateDays(cycle.dateFrom, cycle.dateTo);
                const payableSalaryDays = cycleDays.filter((day) => {
                    const dayKey = formatDateOnly(day);
                    return !vacationDays.has(dayKey) && !sickDays.has(dayKey);
                });
                const sickLeaveDays = cycleDays.filter((day) => sickDays.has(formatDateOnly(day)));

                const salaryAccruedAmount = roundMoney(computeCalendarAmount(employee.rate, payableSalaryDays));
                if (salaryAccruedAmount > 0) {
                    const withheldAmount = computeWithholdingAmount(salaryAccruedAmount);
                    const payableAmount = computeNetAmount(salaryAccruedAmount, withheldAmount);

                    suggestedPayments.push({
                        key: cycle.key,
                        type: cycle.type,
                        encodedType: cycle.key,
                        label: `${getSuggestedPaymentTypeLabel(cycle.type)} за период ${formatDateOnly(cycle.dateFrom)} - ${formatDateOnly(cycle.dateTo)}`,
                        amount: payableAmount,
                        accruedAmount: salaryAccruedAmount,
                        withheldAmount,
                        paidAmount: 0,
                        payableAmount,
                        recommendedDate: formatDateOnly(cycle.payDate),
                        periodFrom: formatDateOnly(cycle.dateFrom),
                        periodTo: formatDateOnly(cycle.dateTo),
                        note: `Период без дней отпуска и больничного, дата выплаты по графику: ${formatDateOnly(cycle.payDate)}.`,
                        sourceSummary: `${cycle.type === 'advance' ? 'Первый платеж месяца (аванс)' : 'Основная зарплата по графику'} · НДФЛ ${roundMoney(DEFAULT_TAX_RATE * 100)}%`,
                    });
                }

                if (sickLeaveDays.length > 0) {
                    const encodedType = `${SICK_LEAVE_PAYMENT_PREFIX}${formatDateOnly(cycle.dateFrom)}:${formatDateOnly(cycle.dateTo)}`;
                    const sickAlreadyPaid = employeePayments.some((payment) =>
                        payment.rawType === encodedType
                        || (
                            payment.paymentKind === 'sick_leave'
                            && payment.periodFrom === formatDateOnly(cycle.dateFrom)
                            && payment.periodTo === formatDateOnly(cycle.dateTo)
                        )
                    );

                    if (!sickAlreadyPaid) {
                        const accruedAmount = roundMoney(computeCalendarAmount(employee.rate, sickLeaveDays));
                        if (accruedAmount > 0) {
                            const withheldAmount = computeWithholdingAmount(accruedAmount);
                            const payableAmount = computeNetAmount(accruedAmount, withheldAmount);
                            suggestedPayments.push({
                                key: encodedType,
                                type: 'sick_leave',
                                encodedType,
                                label: `Больничный за период ${formatDateOnly(cycle.dateFrom)} - ${formatDateOnly(cycle.dateTo)}`,
                                amount: payableAmount,
                                accruedAmount,
                                withheldAmount,
                                paidAmount: 0,
                                payableAmount,
                                recommendedDate: formatDateOnly(cycle.payDate),
                                periodFrom: formatDateOnly(cycle.dateFrom),
                                periodTo: formatDateOnly(cycle.dateTo),
                                note: `Дни со статусом "больничный" в рабочем графике за период ${formatDateOnly(cycle.dateFrom)} - ${formatDateOnly(cycle.dateTo)}.`,
                                sourceSummary: 'Больничный по рабочему графику · НДФЛ 13%',
                            });
                        }
                    }
                }
            }

            for (const vacation of employeeVacations) {
                const dueDate = addDays(vacation.dateFrom, -14);
                if (dueDate < selectedMonthStart || dueDate > selectedMonthEnd) continue;

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

        for (const payment of employeePayments) {
            if (payment.date > selectedMonthEnd) continue;
            if (!payment.paymentKind || (payment.paymentKind !== 'bonus' && payment.paymentKind !== 'sick_leave')) continue;

            const balance = calculatePaymentBalance({
                accruedAmount: payment.accruedAmount,
                withheldAmount: payment.withheldAmount,
                paidAmount: payment.paidAmount,
                payableAmount: payment.payableAmount,
                amount: 0,
            });
            if (balance <= 0) continue;

            const suggestedType = financePaymentKindToSuggestionType(payment.paymentKind);
            const labelBase = getSuggestedPaymentTypeLabel(suggestedType);
            suggestedPayments.push({
                key: `open-payment#${payment.id}`,
                type: suggestedType,
                encodedType: `open-payment#${payment.id}`,
                label: `${labelBase}${payment.periodFrom || payment.periodTo ? ` за период ${payment.periodFrom || payment.periodTo || ''}${payment.periodTo && payment.periodTo !== payment.periodFrom ? ` - ${payment.periodTo}` : ''}` : ''}`,
                amount: balance,
                accruedAmount: balance,
                withheldAmount: 0,
                paidAmount: 0,
                payableAmount: balance,
                recommendedDate: formatDateOnly(payment.date),
                periodFrom: payment.periodFrom,
                periodTo: payment.periodTo,
                note: payment.rawComment || payment.calculation?.note || null,
                sourceSummary: payment.calculation?.source || 'Непогашенное начисление из журнала выплат',
            });
        }

        suggestedPayments.sort((a, b) => {
            const dateDiff = String(a.recommendedDate).localeCompare(String(b.recommendedDate));
            if (dateDiff !== 0) return dateDiff;
            if (a.type !== b.type) return getSuggestedPaymentPriority(a.type) - getSuggestedPaymentPriority(b.type);
            return a.label.localeCompare(b.label, 'ru');
        });

        const employeePaymentsThisMonth = employeePayments.filter(
            (payment) => payment.date >= selectedMonthStart && payment.date <= selectedMonthEnd
        );
        const unpaidCurrentSuggestions = suggestedPayments.filter(
            (item) => !item.encodedType.startsWith(OPEN_PAYMENT_PREFIX)
        );

        const currentBreakdown = {
            advance: 0,
            salary: 0,
            vacation: 0,
            bonus: 0,
            sickLeave: 0,
        };
        let currentAccrued = 0;
        let currentWithheld = 0;
        let currentScheduledPayable = 0;

        for (const payment of employeePaymentsThisMonth) {
            const accruedAmount = getPaymentAccruedAmount(payment);
            const withheldAmount = Number(payment.withheldAmount || 0);
            const payableAmount = Math.max(0, calculatePaymentBalance({
                accruedAmount: payment.accruedAmount,
                withheldAmount: payment.withheldAmount,
                paidAmount: payment.paidAmount,
                payableAmount: payment.payableAmount,
                amount: 0,
            }));

            currentAccrued += accruedAmount;
            currentWithheld += withheldAmount;
            currentScheduledPayable += payableAmount;

            if (payment.paymentKind === 'advance') currentBreakdown.advance += accruedAmount;
            else if (payment.paymentKind === 'vacation') currentBreakdown.vacation += accruedAmount;
            else if (payment.paymentKind === 'bonus') currentBreakdown.bonus += accruedAmount;
            else if (payment.paymentKind === 'sick_leave') currentBreakdown.sickLeave += accruedAmount;
            else currentBreakdown.salary += accruedAmount;
        }

        for (const item of unpaidCurrentSuggestions) {
            currentAccrued += item.accruedAmount;
            currentWithheld += item.withheldAmount;
            currentScheduledPayable += item.payableAmount;

            if (item.type === 'advance') currentBreakdown.advance += item.accruedAmount;
            else if (item.type === 'vacation') currentBreakdown.vacation += item.accruedAmount;
            else if (item.type === 'bonus') currentBreakdown.bonus += item.accruedAmount;
            else if (item.type === 'sick_leave') currentBreakdown.sickLeave += item.accruedAmount;
            else currentBreakdown.salary += item.accruedAmount;
        }

        currentAccrued = roundMoney(currentAccrued);
        currentWithheld = roundMoney(currentWithheld);
        currentScheduledPayable = roundMoney(currentScheduledPayable);
        const contributionBaseBeforeMonth = roundMoney(employeePayments.reduce((sum, payment) => {
            if (payment.date >= selectedMonthStart || payment.date.getUTCFullYear() !== selectedMonthStart.getUTCFullYear()) {
                return sum;
            }
            return sum + getPaymentAccruedAmount(payment);
        }, 0));
        const contributionBaseMonth = roundMoney(currentAccrued);
        const monthBaseAt30 = Math.min(
            contributionBaseMonth,
            Math.max(0, CONTRIBUTION_THRESHOLD - contributionBaseBeforeMonth)
        );
        const monthBaseAt151 = Math.max(0, contributionBaseMonth - monthBaseAt30);
        const contributionYearBaseTotal = contributionBaseBeforeMonth + contributionBaseMonth;
        const contributionYearBase30 = Math.min(contributionYearBaseTotal, CONTRIBUTION_THRESHOLD);
        const contributionYearBase151 = Math.max(0, contributionYearBaseTotal - CONTRIBUTION_THRESHOLD);
        const debtSummary = employeePayments.reduce(
            (acc, payment) => {
                if (payment.date >= selectedMonthStart || payment.date > selectedMonthEnd) return acc;
                const balance = calculatePaymentBalance({
                    accruedAmount: payment.accruedAmount,
                    withheldAmount: payment.withheldAmount,
                    paidAmount: payment.paidAmount,
                    payableAmount: payment.payableAmount,
                    amount: 0,
                });
                if (balance > 0) {
                    acc.orgDebt += balance;
                } else if (balance < 0) {
                    acc.employeeDebt += Math.abs(balance);
                }
                return acc;
            },
            { orgDebt: 0, employeeDebt: 0 }
        );

        return {
            ...employee,
            currentAccrued,
            currentWithheld,
            currentPaid: roundMoney(employeePaymentsThisMonth.reduce((sum, payment) => sum + payment.paidAmount, 0)),
            currentPayable: roundMoney(currentScheduledPayable + debtSummary.orgDebt - debtSummary.employeeDebt),
            currentOrgDebt: roundMoney(debtSummary.orgDebt),
            currentEmployeeDebt: roundMoney(debtSummary.employeeDebt),
            currentContributions: roundMoney(monthBaseAt30 * CONTRIBUTION_RATE_BASE + monthBaseAt151 * CONTRIBUTION_RATE_ABOVE),
            currentContributionDetails: {
                taxableIncomeMonth: contributionBaseMonth,
                contributionBaseMonth,
                contributionYearBase30: roundMoney(contributionYearBase30),
                contributionYearBase151: roundMoney(contributionYearBase151),
            },
            currentBreakdown: {
                advance: roundMoney(currentBreakdown.advance),
                salary: roundMoney(currentBreakdown.salary),
                vacation: roundMoney(currentBreakdown.vacation),
                bonus: roundMoney(currentBreakdown.bonus),
                sickLeave: roundMoney(currentBreakdown.sickLeave),
            },
            suggestedPayments,
            paymentHistory: (paymentHistoryByEmployee.get(employee.id) || []).slice(0, 12),
        };
    });

    const recentPayments = allPayments
        .filter((payment) => {
            const paymentDate = parseDateOnly(payment.date);
            return paymentDate ? paymentDate >= selectedMonthStart && paymentDate <= selectedMonthEnd : false;
        })
        .slice(0, 30);

    return {
        settings,
        paymentTableAvailable: true,
        selectedMonth: formatMonthKey(selectedMonthDate),
        selectedMonthLabel: formatMonthLabel(selectedMonthDate),
        employees: employeesWithSuggestions,
        recentPayments,
        totals: {
            activeEmployees: employeesWithSuggestions.filter((employee) => employee.active).length,
            totalPaid: roundMoney(employeesWithSuggestions.reduce((sum, employee) => sum + employee.currentPaid, 0)),
            paymentCount: recentPayments.length,
        },
    };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<FinanceResponse | { ok: true } | { error: string }>) {
    try {
        const actor = await requirePermission(req, res, 'admin.finance');
        if (!actor) return;

        if (req.method === 'GET') {
            const monthsRaw = Array.isArray(req.query.months) ? req.query.months[0] : req.query.months;
            const monthsParsed = Number(monthsRaw);
            const monthsRequested = [1, 3, 6, 12, 24].includes(monthsParsed) ? monthsParsed : 6;
            const month = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
            const payload = await getFinancePayload(monthsRequested, typeof month === 'string' ? month : null);
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

            const month = typeof body.month === 'string' ? body.month.trim() : null;
            const payload = await getFinancePayload(6, month);
            const employee = payload.employees.find((item) => item.id === employeeId) || null;
            const suggestion = employee?.suggestedPayments.find((item) => item.encodedType === paymentType) || null;
            const openPaymentId = paymentType.startsWith(OPEN_PAYMENT_PREFIX)
                ? paymentType.slice(OPEN_PAYMENT_PREFIX.length)
                : null;

            if (openPaymentId) {
                await settleOpenPaymentRecord({ query: (sql, params) => query(sql, params) }, paymentsMeta, {
                    paymentId: openPaymentId,
                    amount,
                    paymentDate,
                    comment: comment || `Погашение открытого начисления на ${paymentDate}`,
                });
                return res.status(200).json({ ok: true });
            }

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

        if (req.method === 'POST' && (action === 'bulk-payroll-today' || action === 'bulk-payroll-month')) {
            const month = typeof body.month === 'string' ? body.month.trim() : null;
            const paymentDate = typeof body.date === 'string' && body.date.trim()
                ? body.date.trim()
                : new Date().toISOString().slice(0, 10);
            const defaultComment = typeof body.comment === 'string' && body.comment.trim()
                ? body.comment.trim()
                : 'Массовая выплата по графику';
            const selectedEmployeeIds = Array.isArray(body.employeeIds)
                ? body.employeeIds.map((value: unknown) => Number(value)).filter((id: number) => Number.isInteger(id) && id > 0)
                : [];

            const paymentsMeta = await getPaymentsMeta();
            if (!paymentsMeta.exists || !paymentsMeta.employeeCol || !paymentsMeta.amountCol || !paymentsMeta.dateCol) {
                return res.status(400).json({ error: 'Таблица выплат недоступна для записи' });
            }

            const payload = await getFinancePayload(6, month);
            const suggestionsToPay = payload.employees
                .filter((employee) => employee.active && (!selectedEmployeeIds.length || selectedEmployeeIds.includes(employee.id)))
                .flatMap((employee) =>
                    employee.suggestedPayments
                        .filter((item) => item.amount > 0 && (action === 'bulk-payroll-month' || String(item.recommendedDate) <= paymentDate))
                        .map((suggestion) => ({ employee, suggestion }))
                );

            if (!suggestionsToPay.length) {
                return res.status(400).json({ error: 'Нет сотрудников с начислениями к выплате на сегодня' });
            }

            const pool = await getPool();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const item of suggestionsToPay) {
                    const suggestion = item.suggestion;
                    const effectivePaymentDate = action === 'bulk-payroll-month' && suggestion.recommendedDate
                        ? suggestion.recommendedDate
                        : paymentDate;
                    const openPaymentId = suggestion.encodedType.startsWith(OPEN_PAYMENT_PREFIX)
                        ? suggestion.encodedType.slice(OPEN_PAYMENT_PREFIX.length)
                        : null;

                    if (openPaymentId) {
                        await settleOpenPaymentRecord(client, paymentsMeta, {
                            paymentId: openPaymentId,
                            amount: suggestion.amount,
                            paymentDate: effectivePaymentDate,
                            comment: defaultComment,
                        });
                        continue;
                    }

                    const columns = [quoteIdent(paymentsMeta.employeeCol), quoteIdent(paymentsMeta.amountCol), quoteIdent(paymentsMeta.dateCol)];
                    const values: any[] = [item.employee.id, suggestion.amount, effectivePaymentDate];

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
                            paymentDate: effectivePaymentDate,
                        }));
                    }

                    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                    await client.query(
                        `
                        INSERT INTO public.${quoteIdent(paymentsMeta.tableName)} (${columns.join(', ')})
                        VALUES (${placeholders})
                        `,
                        values
                    );
                }

                await client.query('COMMIT');
            } catch (bulkError) {
                await client.query('ROLLBACK');
                throw bulkError;
            } finally {
                client.release();
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
