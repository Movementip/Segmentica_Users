import { getPool, query } from './db';
import {
    getDocumentTemplateDefinition,
    type DocumentTemplateKey,
    type DocumentTemplatePostprocess,
} from './documentTemplates';
import type {
    FinanceStatementTemplatePayload,
    StatementEmployeePayload,
    StatementSourcePayload,
    StatementTemplateCell,
    StatementTemplatePrintArea,
    StatementTemplateRangeCopy,
    StatementTemplateRowVisibility,
    StatementTemplateSheetCopy,
    StatementTemplateSheetPageSetup,
} from './financeStatementDocument';

type TimesheetActor = {
    fio: string;
    position: string | null;
};

type TimesheetEntryPayload = {
    employee: StatementEmployeePayload;
    source: StatementSourcePayload;
};

type CalendarRow = {
    day: string;
    is_workday: boolean;
    is_holiday: boolean;
    is_shortened: boolean;
};

type PatternRow = {
    employee_id: number;
    id: number;
    cycle_schema: string[];
    anchor_date: string;
    date_from: string;
    date_to: string | null;
    shift_start: string | null;
    shift_end: string | null;
    respect_production_calendar: boolean;
    shorten_preholiday: boolean;
};

type VacationRow = {
    employee_id: number;
    id: number;
    date_from: string;
    date_to: string;
    vacation_type: string | null;
};

type ExplicitScheduleItem = {
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    source: string;
    isOverride: boolean;
    isVirtual: boolean;
};

type ResolvedScheduleItem = ExplicitScheduleItem & {
    vacationType?: string | null;
};

type EmploymentRow = {
    employee_id: number;
    department_name: string | null;
    subdivision_name: string | null;
};

type TimesheetSignatory = {
    fio: string;
    shortName: string;
    position: string | null;
};

type TimesheetDayCell = {
    code: string;
    hours: string;
    countsAsWorkedDay: boolean;
    workedHours: number;
};

type TimesheetHalfSummary = {
    days: number;
    hours: number;
};

type TimesheetPayrollLine = {
    code: string;
    account: string;
    quantity: string;
};

type TimesheetReasonLine = {
    code: string;
    quantity: string;
};

type EmployeeTimesheetResolved = {
    employee: StatementEmployeePayload;
    salaryAccount: string;
    displayName: string;
    half1: TimesheetDayCell[];
    half2: TimesheetDayCell[];
    firstHalfSummary: TimesheetHalfSummary;
    secondHalfSummary: TimesheetHalfSummary;
    monthSummary: TimesheetHalfSummary;
    payrollLines: TimesheetPayrollLine[];
    reasonLines: TimesheetReasonLine[];
};

const TEMPLATE_KEY: DocumentTemplateKey = 'finance_timesheet_t13';
const NUMBERING_SETTINGS_KEY = 'finance_timesheet_t13_numbers';
const ORGANIZATION_NAME = 'ООО «Сегментика»';
const OKPO_CODE = '95164141';
const OKUD_CODE = '0301008';
const DEFAULT_DIVISION_NAME = 'Главный офис';
const FIRST_SHEET_NAME = 'Лист1';
const SECOND_SHEET_NAME = 'Лист2';
const FIRST_SHEET_ROW_STARTS = [24, 28, 32, 36, 40, 44, 48, 52, 56];
const SECOND_SHEET_ROW_STARTS = [10, 14, 18, 22, 26, 30, 34, 38, 42, 46];
const EMPLOYEES_PER_DOCUMENT = FIRST_SHEET_ROW_STARTS.length + SECOND_SHEET_ROW_STARTS.length;
const MAX_FIRST_SHEET_EMPLOYEES_WITH_INLINE_FOOTER = 6;
const INLINE_FOOTER_TARGET_START_ROW = FIRST_SHEET_ROW_STARTS[FIRST_SHEET_ROW_STARTS.length - 1] + 4;

const WORKED_STATUSES = new Set([
    'работал',
    'работает',
    'удаленно',
    'удалённо',
]);

const COMMAND_STATUSES = new Set(['командировка']);
const SICK_STATUSES = new Set(['больничный', 'больничный лист']);
const OFF_STATUSES = new Set(['__off__', 'выходной', 'выходной день', 'праздничный день']);

const parseDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const formatDateRu = (value: Date | null): string => {
    if (!value) return '';
    return value.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    });
};

const startOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const endOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

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

const enumerateDays = (dateFrom: Date, dateTo: Date): Date[] => {
    const days: Date[] = [];
    for (let cursor = new Date(dateFrom); cursor <= dateTo; cursor = addDays(cursor, 1)) {
        days.push(new Date(cursor));
    }
    return days;
};

const formatMonthYearFileLabel = (value: Date): string =>
    `${String(value.getUTCMonth() + 1).padStart(2, '0')}.${value.getUTCFullYear()}`;

const MONTH_NAMES_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
];

const toSurnameInitials = (value: string | null | undefined): string => {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return '';
    const [surname, name, middleName] = parts;
    const nameInitial = name ? `${name.charAt(0).toUpperCase()}.` : '';
    const middleInitial = middleName ? ` ${middleName.charAt(0).toUpperCase()}.` : '';
    return `${surname}${nameInitial ? ` ${nameInitial}` : ''}${middleInitial}`;
};

const normalizeStatus = (value: string | null | undefined): string =>
    String(value || '').trim().toLowerCase();

const parseMoney = (value: number | null | undefined): number =>
    Math.round((Number(value) || 0) * 100) / 100;

const formatMoneyRub = (value: number): string =>
    `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseMoney(value))} руб.`;

const calculateShiftHours = (start: string | null | undefined, end: string | null | undefined): number | null => {
    const startValue = String(start || '').trim();
    const endValue = String(end || '').trim();
    if (!startValue || !endValue) return null;

    const [startHours, startMinutes] = startValue.split(':').map((part) => Number(part) || 0);
    const [endHours, endMinutes] = endValue.split(':').map((part) => Number(part) || 0);

    let totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    if (totalMinutes <= 0) {
        totalMinutes += 24 * 60;
    }
    if (totalMinutes > 60) {
        totalMinutes -= 60;
    }
    if (totalMinutes <= 0) return null;

    return Math.round((totalMinutes / 60) * 100) / 100;
};

const subtractHour = (timeValue: string | null) => {
    if (!timeValue) return null;
    const [hoursRaw, minutesRaw] = timeValue.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return timeValue;
    const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
    date.setUTCHours(date.getUTCHours() - 1);
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};

const diffInDays = (left: Date, right: Date) => {
    const utcLeft = Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate());
    const utcRight = Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate());
    return Math.floor((utcLeft - utcRight) / 86400000);
};

const pushCell = (
    cells: StatementTemplateCell[],
    sheetName: string,
    address: string,
    value: string | number,
    style?: StatementTemplateCell['style'],
) => {
    cells.push({ sheetName, address, value, style });
};

const TIMESHEET_MARK_STYLE: NonNullable<StatementTemplateCell['style']> = {
    fontSize: 7,
    horizontal: 'center',
    vertical: 'center',
    shrinkToFit: true,
};

const TIMESHEET_FOOTER_TEXT_STYLE: NonNullable<StatementTemplateCell['style']> = {
    fontSize: 9,
    horizontal: 'center',
    vertical: 'center',
    shrinkToFit: true,
};

const TIMESHEET_EMPLOYEE_NAME_STYLE: NonNullable<StatementTemplateCell['style']> = {
    fontSize: 8,
    horizontal: 'center',
    vertical: 'center',
    wrapText: true,
    shrinkToFit: true,
};

const pushHiddenBlock = (
    rowVisibility: StatementTemplateRowVisibility[],
    sheetName: string,
    startRow: number,
) => {
    for (let row = startRow; row < startRow + 4; row += 1) {
        rowVisibility.push({ sheetName, row, hidden: true });
    }
};

const buildCalendarMap = (rows: CalendarRow[]) => {
    const map = new Map<string, CalendarRow>();
    for (const row of rows) {
        map.set(String(row.day).slice(0, 10), row);
    }
    return map;
};

const resolveVacationCode = (vacationType: string | null | undefined): string => {
    const normalized = normalizeStatus(vacationType);
    if (!normalized) return 'ОТ';
    if (normalized.includes('доп')) return 'ОД';
    if (normalized.includes('без сохран')) return 'ДО';
    return 'ОТ';
};

const resolveSalaryAccount = (position: string | null | undefined): string => {
    const normalized = normalizeStatus(position);
    if (!normalized) return '26';
    if (
        normalized.includes('бухгалтер')
        || normalized.includes('директор')
        || normalized.includes('кадр')
        || normalized.includes('админист')
        || normalized.includes('офис')
    ) {
        return '26';
    }
    if (
        normalized.includes('логист')
        || normalized.includes('продаж')
        || normalized.includes('менеджер')
        || normalized.includes('маркет')
    ) {
        return '44';
    }
    return '23';
};

const buildResolvedItems = (
    visibleDateFrom: Date,
    visibleDateTo: Date,
    explicitItems: ExplicitScheduleItem[],
    calendarRows: CalendarRow[],
    patterns: PatternRow[],
    vacations: VacationRow[],
): ResolvedScheduleItem[] => {
    const explicitMap = new Map<string, ExplicitScheduleItem>();
    for (const item of explicitItems) {
        explicitMap.set(item.date, item);
    }

    const calendarMap = buildCalendarMap(calendarRows);
    const vacationMap = new Map<string, VacationRow>();
    for (const vacation of vacations) {
        let cursor = new Date(vacation.date_from);
        const end = new Date(vacation.date_to);
        while (cursor <= end) {
            vacationMap.set(formatIsoDate(cursor), vacation);
            cursor = addDays(cursor, 1);
        }
    }

    const resolved: ResolvedScheduleItem[] = [];
    let cursor = new Date(visibleDateFrom);

    while (cursor <= visibleDateTo) {
        const dateKey = formatIsoDate(cursor);
        const vacation = vacationMap.get(dateKey);
        const explicit = explicitMap.get(dateKey);

        if (vacation) {
            resolved.push({
                date: dateKey,
                startTime: null,
                endTime: null,
                status: 'отпуск',
                source: 'vacation',
                isOverride: false,
                isVirtual: true,
                vacationType: vacation.vacation_type,
            });
            cursor = addDays(cursor, 1);
            continue;
        }

        if (explicit) {
            resolved.push({ ...explicit });
            cursor = addDays(cursor, 1);
            continue;
        }

        const calendarInfo = calendarMap.get(dateKey);
        const applicablePattern = patterns.find((pattern) => {
            if (dateKey < pattern.date_from) return false;
            if (pattern.date_to && dateKey > pattern.date_to) return false;
            return true;
        });

        if (applicablePattern) {
            const anchorDate = new Date(applicablePattern.anchor_date);
            const cycleLength = applicablePattern.cycle_schema.length;
            const cycleIndex = cycleLength > 0
                ? ((diffInDays(cursor, anchorDate) % cycleLength) + cycleLength) % cycleLength
                : 0;
            const cycleValue = applicablePattern.cycle_schema[cycleIndex];
            const weekendFallback = ![1, 2, 3, 4, 5].includes(cursor.getUTCDay());
            const isCalendarWorkday = calendarInfo ? calendarInfo.is_workday : !weekendFallback;
            const isShortened = calendarInfo ? calendarInfo.is_shortened : false;

            if (cycleValue === 'work' && (!applicablePattern.respect_production_calendar || isCalendarWorkday)) {
                resolved.push({
                    date: dateKey,
                    startTime: applicablePattern.shift_start ? String(applicablePattern.shift_start).slice(0, 5) : null,
                    endTime: applicablePattern.shift_end
                        ? String(
                            applicablePattern.shorten_preholiday && isShortened
                                ? subtractHour(String(applicablePattern.shift_end).slice(0, 5))
                                : applicablePattern.shift_end,
                        ).slice(0, 5)
                        : null,
                    status: 'Работал',
                    source: 'pattern',
                    isOverride: false,
                    isVirtual: true,
                });
            } else {
                resolved.push({
                    date: dateKey,
                    startTime: null,
                    endTime: null,
                    status: '__off__',
                    source: 'pattern',
                    isOverride: false,
                    isVirtual: true,
                });
            }

            cursor = addDays(cursor, 1);
            continue;
        }

        if (calendarInfo && !calendarInfo.is_workday) {
            resolved.push({
                date: dateKey,
                startTime: null,
                endTime: null,
                status: '__off__',
                source: 'calendar',
                isOverride: false,
                isVirtual: true,
            });
        } else {
            resolved.push({
                date: dateKey,
                startTime: null,
                endTime: null,
                status: '__empty__',
                source: 'none',
                isOverride: false,
                isVirtual: true,
            });
        }

        cursor = addDays(cursor, 1);
    }

    return resolved;
};

const classifyDay = (
    date: Date,
    item: ResolvedScheduleItem | undefined,
    calendarMap: Map<string, CalendarRow>,
    defaultShiftHours: number,
): TimesheetDayCell => {
    const dateKey = formatIsoDate(date);
    const calendar = calendarMap.get(dateKey);
    const weekendFallback = ![1, 2, 3, 4, 5].includes(date.getUTCDay());
    const isHoliday = Boolean(calendar?.is_holiday);
    const isWorkday = calendar ? Boolean(calendar.is_workday) : !weekendFallback;
    const status = normalizeStatus(item?.status);

    if (!item || status === '__empty__') {
        if (isWorkday) {
            return { code: 'НН', hours: '', countsAsWorkedDay: false, workedHours: 0 };
        }
        return { code: 'В', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (status === 'отпуск') {
        return { code: resolveVacationCode(item.vacationType), hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (SICK_STATUSES.has(status)) {
        return { code: 'Б', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (COMMAND_STATUSES.has(status)) {
        return { code: 'К', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (status === '__off__' || OFF_STATUSES.has(status)) {
        return { code: 'В', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (WORKED_STATUSES.has(status)) {
        const calculatedHours = calculateShiftHours(item.startTime, item.endTime) ?? defaultShiftHours;
        const displayHours = Number.isInteger(calculatedHours)
            ? String(calculatedHours)
            : String(calculatedHours).replace('.', ',');
        return {
            code: !isWorkday || isHoliday ? 'РВ' : 'Я',
            hours: displayHours,
            countsAsWorkedDay: true,
            workedHours: calculatedHours,
        };
    }

    if (status.includes('отпуск')) {
        return { code: 'ОТ', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (status.includes('больнич')) {
        return { code: 'Б', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (status.includes('команд')) {
        return { code: 'К', hours: '', countsAsWorkedDay: true, workedHours: 0 };
    }

    if (status.includes('прогул')) {
        return { code: 'ПР', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    if (status.includes('неяв')) {
        return { code: 'НН', hours: '', countsAsWorkedDay: false, workedHours: 0 };
    }

    return { code: isWorkday ? 'НН' : 'В', hours: '', countsAsWorkedDay: false, workedHours: 0 };
};

const summarizeHalf = (items: TimesheetDayCell[]): TimesheetHalfSummary => ({
    days: items.filter((item) => item.countsAsWorkedDay).length,
    hours: Math.round(
        items.reduce((sum, item) => sum + (item.countsAsWorkedDay ? item.workedHours : 0), 0) * 100,
    ) / 100,
});

const formatWorkedQuantity = (summary: TimesheetHalfSummary): string => {
    if (!summary.days && !summary.hours) return '-';
    const hours = Number.isInteger(summary.hours) ? String(summary.hours) : String(summary.hours).replace('.', ',');
    return `${summary.days} (${hours})`;
};

const getPeriodBasisDate = (source: StatementSourcePayload): Date => {
    const periodFrom = parseDateOnly(source.periodFrom);
    const periodTo = parseDateOnly(source.periodTo);
    const paymentDate = parseDateOnly(source.paymentDate);
    return periodFrom || periodTo || paymentDate || new Date();
};

const getDocumentNumber = async (documentKey: string): Promise<number> => {
    const pool = await getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const existing = await client.query(
            'SELECT value FROM public.app_settings WHERE key = $1 FOR UPDATE',
            [NUMBERING_SETTINGS_KEY],
        );

        const currentValue = existing.rows?.[0]?.value;
        const state = currentValue && typeof currentValue === 'object'
            ? {
                lastNumber: Number((currentValue as any).lastNumber) || 0,
                assignments: ((currentValue as any).assignments && typeof (currentValue as any).assignments === 'object')
                    ? { ...(currentValue as any).assignments }
                    : {},
            }
            : { lastNumber: 0, assignments: {} as Record<string, number> };

        if (!Number.isInteger(state.assignments[documentKey])) {
            state.lastNumber += 1;
            state.assignments[documentKey] = state.lastNumber;
        }

        if (Number(existing.rowCount || 0) > 0) {
            await client.query(
                'UPDATE public.app_settings SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = $1',
                [NUMBERING_SETTINGS_KEY, JSON.stringify(state)],
            );
        } else {
            await client.query(
                'INSERT INTO public.app_settings (key, value) VALUES ($1, $2::jsonb)',
                [NUMBERING_SETTINGS_KEY, JSON.stringify(state)],
            );
        }

        await client.query('COMMIT');
        return state.assignments[documentKey];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const getDefaultShiftHours = async (employeeId: number, dateFrom: string, dateTo: string): Promise<number> => {
    const res = await query(
        `
        SELECT shift_start, shift_end
        FROM public.employee_schedule_patterns
        WHERE employee_id = $1
          AND is_active = true
          AND date_from <= $3::date
          AND (date_to IS NULL OR date_to >= $2::date)
        ORDER BY date_from DESC, id DESC
        LIMIT 1
        `,
        [employeeId, dateFrom, dateTo],
    );

    const row = res.rows?.[0];
    const start = String(row?.shift_start || '').trim();
    const end = String(row?.shift_end || '').trim();
    if (!start || !end) return 8;

    return calculateShiftHours(start, end) ?? 8;
};

const getTimesheetSignatories = async (actor: TimesheetActor): Promise<{
    responsiblePerson: TimesheetSignatory;
    divisionHead: TimesheetSignatory;
    hrPerson: TimesheetSignatory;
}> => {
    const findByRole = async (roleKey: string): Promise<TimesheetSignatory | null> => {
        const res = await query(
            `
            SELECT e."фио" AS fio, e."должность" AS position
            FROM public.users u
            JOIN public.user_roles ur ON ur.user_id = u.id
            JOIN public.roles r ON r.id = ur.role_id
            JOIN public."Сотрудники" e ON e.id = u.employee_id
            WHERE COALESCE(u.is_active, true) = true
              AND COALESCE(e."активен", true) = true
              AND LOWER(COALESCE(r.key, '')) = LOWER($1)
            ORDER BY u.id ASC
            LIMIT 1
            `,
            [roleKey],
        );
        const row = res.rows?.[0];
        if (!row?.fio) return null;
        return {
            fio: String(row.fio),
            shortName: toSurnameInitials(String(row.fio)),
            position: row.position == null ? null : String(row.position),
        };
    };

    const findByPositionLike = async (pattern: string): Promise<TimesheetSignatory | null> => {
        const res = await query(
            `
            SELECT "фио" AS fio, "должность" AS position
            FROM public."Сотрудники"
            WHERE COALESCE("активен", true) = true
              AND LOWER(COALESCE("должность", '')) LIKE LOWER($1)
            ORDER BY id ASC
            LIMIT 1
            `,
            [pattern],
        );
        const row = res.rows?.[0];
        if (!row?.fio) return null;
        return {
            fio: String(row.fio),
            shortName: toSurnameInitials(String(row.fio)),
            position: row.position == null ? null : String(row.position),
        };
    };

    const actorFallback: TimesheetSignatory = {
        fio: actor.fio,
        shortName: toSurnameInitials(actor.fio),
        position: actor.position,
    };

    const hrPerson = await findByRole('hr')
        || await findByPositionLike('%кадр%')
        || await findByPositionLike('%инспектор%')
        || actorFallback;

    const divisionHead = await findByRole('director')
        || await findByPositionLike('%директор%')
        || actorFallback;

    return {
        responsiblePerson: hrPerson,
        divisionHead,
        hrPerson,
    };
};

const resolveDivisionName = (rows: EmploymentRow[]): string => {
    const normalized = rows
        .map((row) => String(row.subdivision_name || row.department_name || '').trim())
        .filter(Boolean);
    if (!normalized.length) return DEFAULT_DIVISION_NAME;
    const first = normalized[0];
    return normalized.every((value) => value === first) ? first : DEFAULT_DIVISION_NAME;
};

const countCodeDays = (items: TimesheetDayCell[], ...codes: string[]): number =>
    items.reduce((sum, item) => sum + (codes.includes(item.code) ? 1 : 0), 0);

const buildPayrollLines = (
    entry: TimesheetEntryPayload,
    resolved: Pick<EmployeeTimesheetResolved, 'monthSummary' | 'half1' | 'half2'>,
    salaryAccount: string,
): TimesheetPayrollLine[] => {
    const accruals = entry.source.accruals;
    const salaryAmount = parseMoney((accruals?.salary || 0) + (accruals?.advanceOffset || 0));
    const lines: TimesheetPayrollLine[] = [];
    const allDays = [...resolved.half1, ...resolved.half2];

    if (salaryAmount > 0) {
        lines.push({
            code: '2000',
            account: salaryAccount,
            quantity: formatWorkedQuantity(resolved.monthSummary),
        });
    }
    if (parseMoney(accruals?.bonus || 0) > 0) {
        lines.push({
            code: '2002',
            account: salaryAccount,
            quantity: formatWorkedQuantity(resolved.monthSummary),
        });
    }
    if (parseMoney(accruals?.vacation || 0) > 0) {
        const vacationDays = countCodeDays(allDays, 'ОТ', 'ОД', 'ДО', 'ОЗ', 'ДБ');
        lines.push({
            code: '2012',
            account: salaryAccount,
            quantity: String(vacationDays || ''),
        });
    }
    if (parseMoney(accruals?.sickLeave || 0) > 0) {
        const sickDays = countCodeDays(allDays, 'Б', 'Т');
        lines.push({
            code: '2300',
            account: '69',
            quantity: String(sickDays || ''),
        });
    }

    return lines.slice(0, 4);
};

const buildReasonLines = (half1: TimesheetDayCell[], half2: TimesheetDayCell[]): TimesheetReasonLine[] => {
    const counts = new Map<string, number>();
    for (const item of [...half1, ...half2]) {
        if (
            item.code === 'В'
            || item.code === 'Я'
            || item.code === 'РВ'
            || item.code === 'К'
            || item.code === ''
            || item.code === 'X'
        ) continue;
        counts.set(item.code, (counts.get(item.code) || 0) + 1);
    }

    return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
        .slice(0, 4)
        .map(([code, quantity]) => ({ code, quantity: String(quantity) }));
};

const resolveEmployeeTimesheet = async (
    entry: TimesheetEntryPayload,
    calendarRows: CalendarRow[],
    explicitItems: ExplicitScheduleItem[],
    patterns: PatternRow[],
    vacations: VacationRow[],
): Promise<EmployeeTimesheetResolved> => {
    const basisDate = getPeriodBasisDate(entry.source);
    const monthDate = startOfMonthUtc(basisDate);
    const monthStart = startOfMonthUtc(monthDate);
    const monthEnd = endOfMonthUtc(monthDate);
    const defaultShiftHours = await getDefaultShiftHours(entry.employee.id, formatIsoDate(monthStart), formatIsoDate(monthEnd));
    const resolvedItems = buildResolvedItems(monthStart, monthEnd, explicitItems, calendarRows, patterns, vacations);
    const resolvedByDate = new Map(resolvedItems.map((item) => [item.date, item]));
    const calendarMap = buildCalendarMap(calendarRows);

    const firstHalfDays = enumerateDays(monthStart, addDays(monthStart, 14));
    const secondHalfStart = addDays(monthStart, 15);
    const secondHalfDays = secondHalfStart <= monthEnd ? enumerateDays(secondHalfStart, monthEnd) : [];

    const half1 = firstHalfDays.map((day) => classifyDay(day, resolvedByDate.get(formatIsoDate(day)), calendarMap, defaultShiftHours));
    const half2 = Array.from({ length: 16 }, (_, index) => {
        const day = addDays(secondHalfStart, index);
        if (day > monthEnd) {
            return { code: 'X', hours: 'X', countsAsWorkedDay: false, workedHours: 0 };
        }
        return classifyDay(day, resolvedByDate.get(formatIsoDate(day)), calendarMap, defaultShiftHours);
    });

    const firstHalfSummary = summarizeHalf(half1);
    const secondHalfSummary = summarizeHalf(half2);
    const monthSummary = {
        days: firstHalfSummary.days + secondHalfSummary.days,
        hours: Math.round((firstHalfSummary.hours + secondHalfSummary.hours) * 100) / 100,
    };
    const salaryAccount = resolveSalaryAccount(entry.employee.position);

    const displayName = entry.employee.position
        ? `${entry.employee.fio},\n${String(entry.employee.position).toLowerCase()}`
        : entry.employee.fio;

    return {
        employee: entry.employee,
        salaryAccount,
        displayName,
        half1,
        half2,
        firstHalfSummary,
        secondHalfSummary,
        monthSummary,
        payrollLines: buildPayrollLines(entry, { monthSummary, half1, half2 }, salaryAccount),
        reasonLines: buildReasonLines(half1, half2),
    };
};

const fillEmployeeBlock = (
    cells: StatementTemplateCell[],
    sheetName: string,
    startRow: number,
    index: number,
    resolved: EmployeeTimesheetResolved,
) => {
    const codeRow1 = startRow;
    const hoursRow1 = startRow + 1;
    const codeRow2 = startRow + 2;
    const hoursRow2 = startRow + 3;

    pushCell(cells, sheetName, `A${codeRow1}`, index);
    pushCell(cells, sheetName, `B${codeRow1}`, resolved.displayName, TIMESHEET_EMPLOYEE_NAME_STYLE);
    pushCell(cells, sheetName, `C${codeRow1}`, resolved.employee.id);

    resolved.half1.forEach((item, dayIndex) => {
        const column = String.fromCharCode('D'.charCodeAt(0) + dayIndex);
        pushCell(cells, sheetName, `${column}${codeRow1}`, item.code, TIMESHEET_MARK_STYLE);
        if (item.hours) {
            pushCell(cells, sheetName, `${column}${hoursRow1}`, item.hours, TIMESHEET_MARK_STYLE);
        }
    });

    resolved.half2.forEach((item, dayIndex) => {
        const columnCode = String.fromCharCode('D'.charCodeAt(0) + dayIndex);
        pushCell(cells, sheetName, `${columnCode}${codeRow2}`, item.code, TIMESHEET_MARK_STYLE);
        if (item.hours) {
            pushCell(cells, sheetName, `${columnCode}${hoursRow2}`, item.hours, TIMESHEET_MARK_STYLE);
        }
    });

    pushCell(cells, sheetName, `T${codeRow1}`, resolved.firstHalfSummary.days || '');
    pushCell(cells, sheetName, `T${hoursRow1}`, resolved.firstHalfSummary.hours || '');
    pushCell(cells, sheetName, `U${codeRow1}`, resolved.monthSummary.days || '');
    pushCell(cells, sheetName, `U${codeRow2}`, resolved.monthSummary.hours || '');
    pushCell(cells, sheetName, `T${codeRow2}`, resolved.secondHalfSummary.days || '');
    pushCell(cells, sheetName, `T${hoursRow2}`, resolved.secondHalfSummary.hours || '');

    resolved.payrollLines.forEach((line, lineIndex) => {
        const row = startRow + lineIndex;
        pushCell(cells, sheetName, `V${row}`, line.code, TIMESHEET_MARK_STYLE);
        pushCell(cells, sheetName, `W${row}`, line.account, TIMESHEET_MARK_STYLE);
        pushCell(cells, sheetName, `X${row}`, line.quantity || '-', TIMESHEET_MARK_STYLE);
    });

    resolved.reasonLines.forEach((line, lineIndex) => {
        const row = startRow + lineIndex;
        pushCell(cells, sheetName, `AB${row}`, line.code, TIMESHEET_MARK_STYLE);
        pushCell(cells, sheetName, `AC${row}`, line.quantity, TIMESHEET_MARK_STYLE);
    });
};

const buildDocumentKey = (entries: TimesheetEntryPayload[], monthDate: Date): string =>
    `timesheet:${formatMonthYearFileLabel(monthDate)}:${entries.map((entry) => entry.employee.id).sort((a, b) => a - b).join(',')}`;

export const buildFinanceTimesheetBatchTemplatePayload = async (params: {
    actor: TimesheetActor;
    entries: TimesheetEntryPayload[];
}): Promise<FinanceStatementTemplatePayload> => {
    const { actor, entries } = params;
    if (!entries.length) {
        throw new Error('Для табеля учета рабочего времени не выбраны сотрудники');
    }

    const firstEntry = entries[0];
    const monthDate = startOfMonthUtc(getPeriodBasisDate(firstEntry.source));
    const monthStart = startOfMonthUtc(monthDate);
    const monthEnd = endOfMonthUtc(monthDate);
    const documentNumber = await getDocumentNumber(buildDocumentKey(entries, monthDate));
    const template = await getDocumentTemplateDefinition(TEMPLATE_KEY);
    const employeeIds = entries.map((entry) => entry.employee.id);

    const [calendarRes, explicitItemsRes, patternsRes, vacationsRes, employmentRes, signatories] = await Promise.all([
        query(
            `
            SELECT
                TO_CHAR(day, 'YYYY-MM-DD') AS day,
                is_workday,
                is_holiday,
                is_shortened
            FROM public.production_calendar_days
            WHERE day BETWEEN $1::date AND $2::date
            ORDER BY day ASC
            `,
            [formatIsoDate(monthStart), formatIsoDate(monthEnd)],
        ),
        query(
            `
            SELECT
                "сотрудник_id" AS employee_id,
                TO_CHAR("дата", 'YYYY-MM-DD') AS work_date,
                "время_начала" AS time_start,
                "время_окончания" AS time_end,
                COALESCE("статус", 'Работал') AS status,
                COALESCE(source, 'manual') AS source,
                COALESCE(is_override, false) AS is_override
            FROM public."График_работы"
            WHERE "сотрудник_id" = ANY($1::int[])
              AND "дата" BETWEEN $2::date AND $3::date
            ORDER BY "сотрудник_id" ASC, "дата" ASC, "время_начала" ASC NULLS LAST
            `,
            [employeeIds, formatIsoDate(monthStart), formatIsoDate(monthEnd)],
        ),
        query(
            `
            SELECT
                employee_id,
                id,
                cycle_schema,
                TO_CHAR(anchor_date, 'YYYY-MM-DD') AS anchor_date,
                TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
                CASE WHEN date_to IS NULL THEN NULL ELSE TO_CHAR(date_to, 'YYYY-MM-DD') END AS date_to,
                shift_start,
                shift_end,
                respect_production_calendar,
                shorten_preholiday
            FROM public.employee_schedule_patterns
            WHERE employee_id = ANY($1::int[])
              AND is_active = true
              AND date_from <= $3::date
              AND COALESCE(date_to, DATE '9999-12-31') >= $2::date
            ORDER BY employee_id ASC, date_from DESC, id DESC
            `,
            [employeeIds, formatIsoDate(monthStart), formatIsoDate(monthEnd)],
        ),
        query(
            `
            SELECT
                employee_id,
                id,
                TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
                TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to,
                vacation_type
            FROM public.employee_vacations
            WHERE employee_id = ANY($1::int[])
              AND status <> 'cancelled'
              AND date_from <= $3::date
              AND date_to >= $2::date
            ORDER BY employee_id ASC, date_from ASC, id ASC
            `,
            [employeeIds, formatIsoDate(monthStart), formatIsoDate(monthEnd)],
        ).catch((error: any) => {
            if (error?.code === '42P01') {
                return { rows: [] as any[] };
            }
            throw error;
        }),
        query(
            `
            SELECT
                employee_id,
                department_name,
                subdivision_name
            FROM public.employee_employment_details
            WHERE employee_id = ANY($1::int[])
            `,
            [employeeIds],
        ).catch((error: any) => {
            if (error?.code === '42P01') {
                return { rows: [] as any[] };
            }
            throw error;
        }),
        getTimesheetSignatories(actor),
    ]);

    const calendarRows = (calendarRes.rows || []) as CalendarRow[];
    const explicitItemsByEmployee = new Map<number, ExplicitScheduleItem[]>();
    for (const row of explicitItemsRes.rows || []) {
        const employeeId = Number(row.employee_id);
        const bucket = explicitItemsByEmployee.get(employeeId) || [];
        bucket.push({
            date: String(row.work_date || ''),
            startTime: row.time_start ? String(row.time_start).slice(0, 5) : null,
            endTime: row.time_end ? String(row.time_end).slice(0, 5) : null,
            status: String(row.status || 'Работал'),
            source: String(row.source || 'manual'),
            isOverride: Boolean(row.is_override),
            isVirtual: false,
        });
        explicitItemsByEmployee.set(employeeId, bucket);
    }

    const patternsByEmployee = new Map<number, PatternRow[]>();
    for (const row of patternsRes.rows || []) {
        const employeeId = Number(row.employee_id);
        const bucket = patternsByEmployee.get(employeeId) || [];
        bucket.push({
            employee_id: employeeId,
            id: Number(row.id),
            cycle_schema: Array.isArray(row.cycle_schema) ? row.cycle_schema.map((item: unknown) => String(item)) : [],
            anchor_date: String(row.anchor_date || ''),
            date_from: String(row.date_from || ''),
            date_to: row.date_to ? String(row.date_to) : null,
            shift_start: row.shift_start ? String(row.shift_start).slice(0, 5) : null,
            shift_end: row.shift_end ? String(row.shift_end).slice(0, 5) : null,
            respect_production_calendar: Boolean(row.respect_production_calendar),
            shorten_preholiday: Boolean(row.shorten_preholiday),
        });
        patternsByEmployee.set(employeeId, bucket);
    }

    const vacationsByEmployee = new Map<number, VacationRow[]>();
    for (const row of vacationsRes.rows || []) {
        const employeeId = Number(row.employee_id);
        const bucket = vacationsByEmployee.get(employeeId) || [];
        bucket.push({
            employee_id: employeeId,
            id: Number(row.id),
            date_from: String(row.date_from || ''),
            date_to: String(row.date_to || ''),
            vacation_type: row.vacation_type == null ? null : String(row.vacation_type),
        });
        vacationsByEmployee.set(employeeId, bucket);
    }

    const divisionName = resolveDivisionName((employmentRes.rows || []) as EmploymentRow[]);
    const resolvedEntries = await Promise.all(
        entries.map((entry) =>
            resolveEmployeeTimesheet(
                entry,
                calendarRows,
                explicitItemsByEmployee.get(entry.employee.id) || [],
                patternsByEmployee.get(entry.employee.id) || [],
                vacationsByEmployee.get(entry.employee.id) || [],
            ),
        ),
    );

    const cells: StatementTemplateCell[] = [];
    const rowVisibility: StatementTemplateRowVisibility[] = [];
    const printAreas: StatementTemplatePrintArea[] = [];
    const rangeCopies: StatementTemplateRangeCopy[] = [];
    const sheetCopies: StatementTemplateSheetCopy[] = [];
    const sheetPageSetup: StatementTemplateSheetPageSetup[] = [];
    const hiddenSheets: string[] = [];

    const documentDate = new Date();
    const documentMonthLabel = MONTH_NAMES_GENITIVE[documentDate.getUTCMonth()] || '';
    const baseName = entries.length === 1
        ? `Табель учета рабочего времени ${toSurnameInitials(entries[0].employee.fio) || entries[0].employee.fio} ${formatMonthYearFileLabel(monthDate)}`.trim()
        : `Табели учета рабочего времени ${formatMonthYearFileLabel(monthDate)}`.trim();

    const chunkCount = Math.ceil(resolvedEntries.length / EMPLOYEES_PER_DOCUMENT);
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const pairEntries = resolvedEntries.slice(
            chunkIndex * EMPLOYEES_PER_DOCUMENT,
            (chunkIndex + 1) * EMPLOYEES_PER_DOCUMENT,
        );
        const firstSheetName = chunkIndex === 0 ? FIRST_SHEET_NAME : `${FIRST_SHEET_NAME}_${chunkIndex + 1}`;
        const secondSheetName = chunkIndex === 0 ? SECOND_SHEET_NAME : `${SECOND_SHEET_NAME}_${chunkIndex + 1}`;

        if (chunkIndex > 0) {
            sheetCopies.push({ sourceSheetName: FIRST_SHEET_NAME, targetSheetName: firstSheetName });
            sheetCopies.push({ sourceSheetName: SECOND_SHEET_NAME, targetSheetName: secondSheetName });
        }

        pushCell(cells, firstSheetName, 'A8', ORGANIZATION_NAME);
        pushCell(cells, firstSheetName, 'A10', divisionName);
        pushCell(cells, firstSheetName, 'AD8', OKPO_CODE);
        pushCell(cells, firstSheetName, 'W14', documentNumber);
        pushCell(cells, firstSheetName, 'Y14', formatDateRu(documentDate));
        pushCell(cells, firstSheetName, 'AB14', formatDateRu(monthStart));
        pushCell(cells, firstSheetName, 'AD14', formatDateRu(monthEnd));

        pushCell(cells, secondSheetName, 'C51', signatories.responsiblePerson.position || 'Ответственное лицо', TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, secondSheetName, 'O51', signatories.responsiblePerson.shortName, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, secondSheetName, 'AC51', signatories.divisionHead.shortName, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, secondSheetName, 'AC55', signatories.hrPerson.shortName, TIMESHEET_FOOTER_TEXT_STYLE);

        const firstSheetEntries = pairEntries.slice(0, FIRST_SHEET_ROW_STARTS.length);
        const secondSheetEntries = pairEntries.slice(FIRST_SHEET_ROW_STARTS.length);
        const renderFooterOnFirstSheet =
            chunkCount === 1 && secondSheetEntries.length === 0 && firstSheetEntries.length <= MAX_FIRST_SHEET_EMPLOYEES_WITH_INLINE_FOOTER;
        const lastUsedFirstSheetRow = firstSheetEntries.length
            ? FIRST_SHEET_ROW_STARTS[firstSheetEntries.length - 1] + 3
            : FIRST_SHEET_ROW_STARTS[0] - 1;
        const footerStartRow = renderFooterOnFirstSheet ? INLINE_FOOTER_TARGET_START_ROW : lastUsedFirstSheetRow + 2;
        const footerSheetName = renderFooterOnFirstSheet ? firstSheetName : secondSheetName;
        const footerRowOffset = renderFooterOnFirstSheet ? footerStartRow - 50 : 0;

        printAreas.push({
            sheetName: firstSheetName,
            range: renderFooterOnFirstSheet ? `A1:AE${footerStartRow + 9}` : 'A1:AE59',
        });
        sheetPageSetup.push({ sheetName: firstSheetName, fitToWidth: 1, fitToHeight: 1 });

        if (renderFooterOnFirstSheet) {
            rangeCopies.push({
                sourceSheetName: secondSheetName,
                sourceRange: 'A50:AE59',
                targetSheetName: firstSheetName,
                targetStartAddress: `A${footerStartRow}`,
            });
            hiddenSheets.push(secondSheetName);
        } else {
            printAreas.push({ sheetName: secondSheetName, range: 'A1:AE59' });
            sheetPageSetup.push({ sheetName: secondSheetName, fitToWidth: 1, fitToHeight: 1 });
        }

        FIRST_SHEET_ROW_STARTS.forEach((startRow, index) => {
            const entry = firstSheetEntries[index];
            if (entry) {
                fillEmployeeBlock(cells, firstSheetName, startRow, chunkIndex * EMPLOYEES_PER_DOCUMENT + index + 1, entry);
            } else {
                pushHiddenBlock(rowVisibility, firstSheetName, startRow);
            }
        });

        SECOND_SHEET_ROW_STARTS.forEach((startRow, index) => {
            const entry = secondSheetEntries[index];
            if (entry) {
                fillEmployeeBlock(
                    cells,
                    secondSheetName,
                    startRow,
                    chunkIndex * EMPLOYEES_PER_DOCUMENT + FIRST_SHEET_ROW_STARTS.length + index + 1,
                    entry,
                );
            } else {
                pushHiddenBlock(rowVisibility, secondSheetName, startRow);
            }
        });

        pushCell(cells, footerSheetName, `C${51 + footerRowOffset}`, signatories.responsiblePerson.position || 'Ответственное лицо', TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `O${51 + footerRowOffset}`, signatories.responsiblePerson.shortName, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AC${51 + footerRowOffset}`, signatories.divisionHead.shortName, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AC${55 + footerRowOffset}`, signatories.hrPerson.shortName, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AC${53 + footerRowOffset}`, `"${String(documentDate.getUTCDate()).padStart(2, '0')}"`, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AD${53 + footerRowOffset}`, documentMonthLabel, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AE${53 + footerRowOffset}`, `${documentDate.getUTCFullYear()}`, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AC${57 + footerRowOffset}`, `"${String(documentDate.getUTCDate()).padStart(2, '0')}"`, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AD${57 + footerRowOffset}`, documentMonthLabel, TIMESHEET_FOOTER_TEXT_STYLE);
        pushCell(cells, footerSheetName, `AE${57 + footerRowOffset}`, `${documentDate.getUTCFullYear()}`, TIMESHEET_FOOTER_TEXT_STYLE);
    }

    return {
        templateKey: TEMPLATE_KEY,
        templateName: template.templateName,
        fileBaseName: baseName,
        previewTitle: 'Табель учета рабочего времени',
        pdfPostprocess: template.pdfPostprocess as DocumentTemplatePostprocess,
        cells,
        rowVisibility,
        rowHeights: [],
        printAreas,
        rangeCopies,
        sheetCopies,
        hiddenSheets,
        sheetPageSetup,
    };
};
