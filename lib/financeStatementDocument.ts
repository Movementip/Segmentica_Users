import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import { getPool, query } from './db';
import {
    getDocumentTemplateDefinition,
    type DocumentTemplateKey,
    type DocumentTemplatePostprocess,
} from './documentTemplates';

type StatementActor = {
    fio: string;
    position: string | null;
};

export type StatementEmployeePayload = {
    id: number;
    fio: string;
    position: string | null;
    rate: number | null;
};

export type StatementSourcePayload = {
    key: string;
    label: string;
    paymentKind: string;
    sourceType: 'current' | 'history';
    paymentId: string | null;
    accruedAmount: number;
    withheldAmount: number;
    paidAmount: number;
    payableAmount: number;
    amount: number;
    periodFrom: string | null;
    periodTo: string | null;
    paymentDate: string | null;
    comment: string | null;
    sourceSummary: string | null;
    accruals?: {
        salary: number;
        bonus: number;
        sickLeave: number;
        vacation: number;
        otherIncome: number;
        totalAccrued: number;
        incomeTax: number;
        hospitalOffset: number;
        advanceOffset: number;
        orgDebt: number;
        employeeDebt: number;
        payable: number;
    };
};

type WorkedSummary = {
    workdayDays: number;
    workdayHours: number;
    weekendDays: number;
    weekendHours: number;
    holidayDays: number;
    holidayHours: number;
};

type StatementAccrualColumns = {
    salary: number;
    bonus: number;
    sickLeave: number;
    vacation: number;
    otherIncome: number;
    totalAccrued: number;
    incomeTax: number;
    hospitalOffset: number;
    advanceOffset: number;
    orgDebt: number;
    employeeDebt: number;
    payable: number;
};

type StatementNumberingState = {
    lastNumber: number;
    assignments: Record<string, number>;
};

type StatementFiles = {
    excelPath: string;
    htmlPath: string;
    fileBaseName: string;
};

export type StatementTemplateCell = {
    sheetName?: string;
    address: string;
    value: string | number;
    style?: StatementTemplateCellStyle;
};

export type StatementTemplateRowVisibility = {
    sheetName: string;
    row: number;
    hidden: boolean;
};

export type StatementTemplateCellStyle = {
    fontName?: string;
    fontSize?: number;
    bold?: boolean;
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean;
    shrinkToFit?: boolean;
};

export type StatementTemplateRowHeight = {
    sheetName: string;
    row: number;
    height: number;
};

export type StatementTemplatePrintArea = {
    sheetName: string;
    range: string;
};

export type StatementTemplateRangeCopy = {
    sourceSheetName: string;
    sourceRange: string;
    targetSheetName: string;
    targetStartAddress: string;
};

export type StatementTemplateSheetCopy = {
    sourceSheetName: string;
    targetSheetName: string;
};

export type StatementTemplateSheetPageSetup = {
    sheetName: string;
    fitToWidth?: number;
    fitToHeight?: number;
};

export type FinanceStatementTemplatePayload = {
    templateKey: DocumentTemplateKey;
    templateName: string;
    fileBaseName: string;
    previewTitle: string;
    pdfPostprocess: DocumentTemplatePostprocess;
    cells: StatementTemplateCell[];
    rowVisibility: StatementTemplateRowVisibility[];
    rowHeights: StatementTemplateRowHeight[];
    printAreas: StatementTemplatePrintArea[];
    rangeCopies: StatementTemplateRangeCopy[];
    sheetCopies: StatementTemplateSheetCopy[];
    hiddenSheets: string[];
    sheetPageSetup: StatementTemplateSheetPageSetup[];
};

type StatementEntryPayload = {
    employee: StatementEmployeePayload;
    source: StatementSourcePayload;
};

type StatementPreparedEntry = StatementEntryPayload & {
    workedSummary: WorkedSummary;
    accrualColumns: StatementAccrualColumns;
};

const TEMPLATE_KEY: DocumentTemplateKey = 'finance_statement_t49';
const NUMBERING_SETTINGS_KEY = 'finance_statement_numbers';

const ORGANIZATION_NAME = 'Общество с ограниченной ответственностью "Сегментика"';
const STRUCTURAL_DIVISION = 'Главный офис';
const OKPO_CODE = '95164141';
const OKUD_CODE = '0301009';

const WORKED_STATUSES = new Set([
    'работал',
    'работает',
    'удаленно',
    'удалённо',
    'командировка',
]);

const SICK_STATUSES = new Set(['больничный', 'больничный лист']);
const DEFAULT_TAX_RATE = 0.13;

const numberFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const parseDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatDateOnly = (value: Date | null): string => {
    if (!value) return '';
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
};

const formatIsoDate = (value: Date | null): string => {
    if (!value) return '';
    return value.toISOString().slice(0, 10);
};

const startOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const endOfMonthUtc = (value: Date): Date =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

const formatMonthNameRu = (value: Date | null): string => {
    if (!value) return '';
    return value.toLocaleDateString('ru-RU', {
        month: 'long',
        timeZone: 'UTC',
    });
};

const formatMonthYearFileLabel = (value: Date | null): string => {
    if (!value) return '';
    return `${String(value.getUTCMonth() + 1).padStart(2, '0')}.${value.getUTCFullYear()}`;
};

const formatMonthNameRuGenitive = (value: Date | null): string => {
    if (!value) return '';
    const monthNames = [
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
    return monthNames[value.getUTCMonth()] || formatMonthNameRu(value);
};

const formatMoney = (value: number): string => numberFormatter.format(Number(value) || 0);
const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

const splitMoney = (value: number): { rubles: string; kopecks: string; formatted: string } => {
    const normalized = roundMoney(Number(value) || 0);
    const absolute = Math.abs(normalized);
    const rubles = Math.floor(absolute);
    const kopecks = Math.round((absolute - rubles) * 100);
    return {
        rubles: integerFormatter.format(rubles),
        kopecks: String(kopecks).padStart(2, '0'),
        formatted: formatMoney(normalized),
    };
};

const addDays = (value: Date, days: number): Date => {
    const next = new Date(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const enumerateDays = (dateFrom: Date, dateTo: Date): Date[] => {
    const result: Date[] = [];
    for (let cursor = new Date(dateFrom); cursor <= dateTo; cursor = addDays(cursor, 1)) {
        result.push(new Date(cursor));
    }
    return result;
};

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

const formatHours = (value: number): string => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};

const formatWorkedCell = (days: number, hours: number): string => `${days} (${formatHours(hours)})`;

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

    // Для смен в графике считаем стандартный час обеда.
    if (totalMinutes > 60) {
        totalMinutes -= 60;
    }

    if (totalMinutes <= 0) return null;
    return Math.round((totalMinutes / 60) * 100) / 100;
};

const getRussianPlural = (value: number, one: string, few: string, many: string): string => {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
};

const numberToWordsRu = (value: number): string => {
    const unitsMale = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    const tripletToWords = (triplet: number, female: boolean) => {
        if (!triplet) return '';
        const parts: string[] = [];
        const unitWords = female ? unitsFemale : unitsMale;
        const h = Math.floor(triplet / 100);
        const t = Math.floor((triplet % 100) / 10);
        const u = triplet % 10;

        if (h) parts.push(hundreds[h]);
        if (t === 1) {
            parts.push(teens[u]);
        } else {
            if (t) parts.push(tens[t]);
            if (u) parts.push(unitWords[u]);
        }
        return parts.join(' ');
    };

    const integer = Math.floor(Math.abs(value));
    if (integer === 0) return 'Ноль рублей';

    const groups = [
        { divisor: 1_000_000_000, one: 'миллиард', few: 'миллиарда', many: 'миллиардов', female: false },
        { divisor: 1_000_000, one: 'миллион', few: 'миллиона', many: 'миллионов', female: false },
        { divisor: 1_000, one: 'тысяча', few: 'тысячи', many: 'тысяч', female: true },
        { divisor: 1, one: 'рубль', few: 'рубля', many: 'рублей', female: false },
    ];

    let remainder = integer;
    const words: string[] = [];

    for (const group of groups) {
        const chunk = Math.floor(remainder / group.divisor);
        remainder %= group.divisor;
        if (!chunk) continue;

        const chunkWords = tripletToWords(chunk, group.female);
        const suffix = getRussianPlural(chunk, group.one, group.few, group.many);
        words.push(chunkWords, suffix);
    }

    const phrase = words.join(' ').replace(/\s+/g, ' ').trim();
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

const numberToWordsWithoutCurrency = (value: number): string =>
    numberToWordsRu(value).replace(/\s+руб(ль|ля|лей)$/i, '');

const buildDocumentKey = (employee: StatementEmployeePayload, source: StatementSourcePayload) => {
    const sourcePart = source.paymentId
        ? `payment:${source.paymentId}`
        : `${source.sourceType}:${source.key}:${source.periodFrom || 'none'}:${source.periodTo || 'none'}:${source.paymentDate || 'none'}`;
    return `employee:${employee.id}:${sourcePart}`;
};

const getStatementNumber = async (documentKey: string): Promise<number> => {
    const pool = await getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existing = await client.query(
            'SELECT value FROM public.app_settings WHERE key = $1 FOR UPDATE',
            [NUMBERING_SETTINGS_KEY]
        );

        const currentValue = existing.rows?.[0]?.value;
        const state: StatementNumberingState = currentValue && typeof currentValue === 'object'
            ? {
                lastNumber: Number((currentValue as any).lastNumber) || 0,
                assignments: ((currentValue as any).assignments && typeof (currentValue as any).assignments === 'object')
                    ? { ...(currentValue as any).assignments }
                    : {},
            }
            : { lastNumber: 0, assignments: {} };

        if (!Number.isInteger(state.assignments[documentKey])) {
            state.lastNumber += 1;
            state.assignments[documentKey] = state.lastNumber;
        }

        if (Number(existing.rowCount || 0) > 0) {
            await client.query(
                'UPDATE public.app_settings SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = $1',
                [NUMBERING_SETTINGS_KEY, JSON.stringify(state)]
            );
        } else {
            await client.query(
                'INSERT INTO public.app_settings (key, value) VALUES ($1, $2::jsonb)',
                [NUMBERING_SETTINGS_KEY, JSON.stringify(state)]
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
        [employeeId, dateFrom, dateTo]
    );

    const row = res.rows?.[0];
    const start = String(row?.shift_start || '').trim();
    const end = String(row?.shift_end || '').trim();
    if (!start || !end) return 8;

    return calculateShiftHours(start, end) ?? 8;
};

const getWorkedSummary = async (employeeId: number, periodFrom: string | null, periodTo: string | null): Promise<WorkedSummary> => {
    const start = parseDateOnly(periodFrom);
    const end = parseDateOnly(periodTo);
    if (!start || !end || start > end) {
        return {
            workdayDays: 0,
            workdayHours: 0,
            weekendDays: 0,
            weekendHours: 0,
            holidayDays: 0,
            holidayHours: 0,
        };
    }

    const startIso = formatIsoDate(start);
    const endIso = formatIsoDate(end);

    const [scheduleRes, calendarRes] = await Promise.all([
        query(
            `
            SELECT "дата" AS day, "статус" AS status, "время_начала" AS time_start, "время_окончания" AS time_end
            FROM public."График_работы"
            WHERE "сотрудник_id" = $1
              AND "дата" BETWEEN $2::date AND $3::date
            ORDER BY "дата" ASC
            `,
            [employeeId, startIso, endIso]
        ),
        query(
            `
            SELECT day, is_workday, is_holiday
            FROM public.production_calendar_days
            WHERE day BETWEEN $1::date AND $2::date
            `,
            [startIso, endIso]
        ),
    ]);

    const defaultShiftHours = await getDefaultShiftHours(employeeId, startIso, endIso);

    const calendarByDay = new Map<string, { isWorkday: boolean; isHoliday: boolean }>();
    for (const row of calendarRes.rows || []) {
        const day = parseDateOnly(row.day);
        if (!day) continue;
        calendarByDay.set(formatIsoDate(day), {
            isWorkday: Boolean(row.is_workday),
            isHoliday: Boolean(row.is_holiday),
        });
    }

    const scheduleByDay = new Map<string, any>();
    for (const row of scheduleRes.rows || []) {
        const day = parseDateOnly(row.day);
        if (!day) continue;
        scheduleByDay.set(formatIsoDate(day), row);
    }

    const summary: WorkedSummary = {
        workdayDays: 0,
        workdayHours: 0,
        weekendDays: 0,
        weekendHours: 0,
        holidayDays: 0,
        holidayHours: 0,
    };

    for (const day of enumerateDays(start, end)) {
        const key = formatIsoDate(day);
        const schedule = scheduleByDay.get(key);
        const rawStatus = String(schedule?.status || '').trim().toLowerCase();
        if (!WORKED_STATUSES.has(rawStatus)) continue;

        let hours = defaultShiftHours;
        const calculatedHours = calculateShiftHours(schedule?.time_start, schedule?.time_end);
        if (calculatedHours != null) {
            hours = calculatedHours;
        }

        const calendar = calendarByDay.get(key);
        const isHoliday = Boolean(calendar?.isHoliday);
        const isWorkday = calendar ? Boolean(calendar.isWorkday) : ![0, 6].includes(day.getUTCDay());

        if (isHoliday) {
            summary.holidayDays += 1;
            summary.holidayHours += hours;
        } else if (isWorkday) {
            summary.workdayDays += 1;
            summary.workdayHours += hours;
        } else {
            summary.weekendDays += 1;
            summary.weekendHours += hours;
        }
    }

    return summary;
};

const getChiefAccountant = async (): Promise<StatementActor | null> => {
    const res = await query(
        `
        SELECT e."фио" AS fio, e."должность" AS position
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        JOIN public."Сотрудники" e ON e.id = u.employee_id
        WHERE COALESCE(u.is_active, true) = true
          AND COALESCE(e."активен", true) = true
          AND LOWER(COALESCE(r.key, '')) = 'accountant'
        ORDER BY u.id ASC
        LIMIT 1
        `
    );

    let row = res.rows?.[0];
    if (!row?.fio) {
        const fallbackRes = await query(
            `
            SELECT "фио" AS fio, "должность" AS position
            FROM public."Сотрудники"
            WHERE COALESCE("активен", true) = true
              AND LOWER(COALESCE("должность", '')) LIKE '%бухгалтер%'
            ORDER BY id ASC
            LIMIT 1
            `
        );
        row = fallbackRes.rows?.[0];
    }

    if (!row?.fio) return null;
    return {
        fio: String(row.fio),
        position: row.position == null ? null : String(row.position),
    };
};

const ensureCell = (sheet: XLSX.WorkSheet, address: string) => {
    const existing = sheet[address] || { t: 's', v: '' };
    sheet[address] = existing;

    const ref = sheet['!ref'] || `${address}:${address}`;
    const range = XLSX.utils.decode_range(ref);
    const cell = XLSX.utils.decode_cell(address);

    range.s.r = Math.min(range.s.r, cell.r);
    range.s.c = Math.min(range.s.c, cell.c);
    range.e.r = Math.max(range.e.r, cell.r);
    range.e.c = Math.max(range.e.c, cell.c);
    sheet['!ref'] = XLSX.utils.encode_range(range);

    return sheet[address]!;
};

const setCellValue = (sheet: XLSX.WorkSheet, address: string, value: string | number) => {
    const cell = ensureCell(sheet, address);
    cell.v = value;
    cell.t = typeof value === 'number' ? 'n' : 's';
    delete cell.w;
};

const buildPreviewHtml = (sheet: XLSX.WorkSheet, title: string) => {
    const sheetHtml = XLSX.utils.sheet_to_html(sheet, { editable: false, id: 'statement-sheet' });
    return [
        '<!doctype html>',
        '<html lang="ru">',
        '<head>',
        '<meta charset="utf-8" />',
        `<title>${title}</title>`,
        '<style>',
        'body{margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;}',
        '.sheet-wrap{max-width:1600px;margin:0 auto;background:#fff;padding:18px;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08);overflow:auto;}',
        'table{border-collapse:collapse;}',
        '@media print{body{background:#fff;padding:0}.sheet-wrap{max-width:none;padding:0;box-shadow:none;border-radius:0}}',
        '</style>',
        '</head>',
        '<body>',
        '<div class="sheet-wrap">',
        sheetHtml,
        '</div>',
        '</body>',
        '</html>',
    ].join('');
};

const FIRST_SHEET_NAME = 'Лист1';
const SECOND_SHEET_NAME = 'Лист2';
const FIRST_SHEET_ROW_START = 25;
const FIRST_SHEET_ROW_END = 34;
const FIRST_SHEET_TOTAL_ROW = 35;
const SECOND_SHEET_ROW_START = 7;
const SECOND_SHEET_ROW_END = 27;
const SECOND_SHEET_TOTAL_ROW = 28;
const MAX_STATEMENT_EMPLOYEES = (FIRST_SHEET_ROW_END - FIRST_SHEET_ROW_START + 1) + (SECOND_SHEET_ROW_END - SECOND_SHEET_ROW_START + 1);

const getStatementSourceLabel = (source: StatementSourcePayload): string =>
    source.paymentKind === 'advance'
        ? 'Аванс'
        : source.paymentKind === 'vacation'
            ? 'Отпускные'
            : source.paymentKind === 'bonus'
                ? 'Премия'
                : source.paymentKind === 'sick_leave'
                    ? 'Больничный'
                    : 'Зарплата';

const pushCell = (
    target: StatementTemplateCell[],
    sheetName: string,
    address: string,
    value: string | number,
    style?: StatementTemplateCellStyle
) => {
    target.push({ sheetName, address, value, style });
};

const pushHiddenRows = (
    target: StatementTemplateRowVisibility[],
    sheetName: string,
    startRow: number,
    endRow: number
) => {
    if (endRow < startRow) return;
    for (let row = startRow; row <= endRow; row += 1) {
        target.push({ sheetName, row, hidden: true });
    }
};

const pushRowHeight = (
    target: StatementTemplateRowHeight[],
    sheetName: string,
    row: number,
    height: number
) => {
    target.push({ sheetName, row, height });
};

const pushPrintArea = (
    target: StatementTemplatePrintArea[],
    sheetName: string,
    range: string
) => {
    target.push({ sheetName, range });
};

const pushRangeCopy = (
    target: StatementTemplateRangeCopy[],
    sourceSheetName: string,
    sourceRange: string,
    targetSheetName: string,
    targetStartAddress: string
) => {
    target.push({ sourceSheetName, sourceRange, targetSheetName, targetStartAddress });
};

const pushSheetPageSetup = (
    target: StatementTemplateSheetPageSetup[],
    sheetName: string,
    fitToWidth: number,
    fitToHeight: number
) => {
    target.push({ sheetName, fitToWidth, fitToHeight });
};

const offsetCellAddress = (address: string, rowOffset: number): string =>
    address.replace(/(\d+)$/, (_, row) => String(Number(row) + rowOffset));

const getEntryRowHeight = (entry: StatementPreparedEntry): number => {
    const position = String(entry.employee.position || '').trim();
    if (position.length > 22) return 28;
    if (position.length > 14) return 22;
    return 18;
};

const writableFieldStyle = (
    overrides: Partial<StatementTemplateCellStyle> = {}
): StatementTemplateCellStyle => ({
    fontName: 'Arial Cyr',
    fontSize: 10,
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
    shrinkToFit: false,
    ...overrides,
});

const lineFieldStyle = (
    overrides: Partial<StatementTemplateCellStyle> = {}
): StatementTemplateCellStyle => writableFieldStyle({
    vertical: 'bottom',
    wrapText: false,
    shrinkToFit: true,
    ...overrides,
});

const compactTableFieldStyle = (
    overrides: Partial<StatementTemplateCellStyle> = {}
): StatementTemplateCellStyle => writableFieldStyle({
    fontSize: 9,
    vertical: 'center',
    wrapText: false,
    shrinkToFit: true,
    ...overrides,
});

const workedCellStyle = (
    overrides: Partial<StatementTemplateCellStyle> = {}
): StatementTemplateCellStyle => compactTableFieldStyle({
    fontSize: 8,
    horizontal: 'center',
    vertical: 'center',
    wrapText: false,
    shrinkToFit: true,
    ...overrides,
});

const buildDocumentKeyForEntries = (entries: StatementEntryPayload[]) =>
    entries
        .map((entry) => buildDocumentKey(entry.employee, entry.source))
        .sort()
        .join('|');

const getSourceAccrualColumns = (source: StatementSourcePayload): StatementAccrualColumns => {
    const accruedAmount = Number(source.accruedAmount || 0);
    const withheldAmount = Number(source.withheldAmount || 0);
    const payableAmount = Number(source.payableAmount || 0);
    if (source.accruals) {
        const totalAccrued = Number(source.accruals.totalAccrued || 0);
        const incomeTax = Number(source.accruals.incomeTax || 0);
        const hospitalOffset = Number(source.accruals.hospitalOffset || 0);
        const orgDebt = Number(source.accruals.orgDebt || 0);
        const employeeDebt = Number(source.accruals.employeeDebt || 0);
        return {
            salary: Number(source.accruals.salary || 0),
            bonus: Number(source.accruals.bonus || 0),
            sickLeave: Number(source.accruals.sickLeave || 0),
            vacation: Number(source.accruals.vacation || 0),
            otherIncome: Number(source.accruals.otherIncome || 0),
            totalAccrued,
            incomeTax,
            hospitalOffset,
            advanceOffset: Number(source.accruals.advanceOffset || 0),
            orgDebt,
            employeeDebt,
            payable: Number(source.accruals.payable || 0),
        };
    }

    return {
        salary: source.paymentKind === 'salary' || source.paymentKind === 'advance' ? accruedAmount : 0,
        bonus: source.paymentKind === 'bonus' ? accruedAmount : 0,
        sickLeave: source.paymentKind === 'sick_leave' ? accruedAmount : 0,
        vacation: source.paymentKind === 'vacation' ? accruedAmount : 0,
        otherIncome: 0,
        totalAccrued: accruedAmount,
        incomeTax: withheldAmount,
        hospitalOffset: 0,
        advanceOffset: 0,
        orgDebt: 0,
        employeeDebt: 0,
        payable: payableAmount,
    };
};

const getMonthlyStatementAccrualColumns = async (
    employee: StatementEmployeePayload,
    source: StatementSourcePayload
): Promise<StatementAccrualColumns> => {
    const isRecordedMonthAggregate = source.key.startsWith('month-recorded#')
        || source.sourceSummary === 'Журнал выплат за выбранный месяц';

    if (
        isRecordedMonthAggregate
        || source.sourceType !== 'current'
        || !source.accruals
        || employee.rate == null
        || employee.rate <= 0
    ) {
        return getSourceAccrualColumns(source);
    }

    const start = parseDateOnly(source.periodFrom);
    const end = parseDateOnly(source.periodTo);
    if (!start || !end || start > end) {
        return getSourceAccrualColumns(source);
    }

    const startIso = formatIsoDate(start);
    const endIso = formatIsoDate(end);

    const [scheduleRes, vacationRes] = await Promise.all([
        query(
            `
            SELECT "дата" AS day, "статус" AS status
            FROM public."График_работы"
            WHERE "сотрудник_id" = $1
              AND "дата" BETWEEN $2::date AND $3::date
            ORDER BY "дата" ASC
            `,
            [employee.id, startIso, endIso]
        ),
        query(
            `
            SELECT date_from, date_to
            FROM public.employee_vacations
            WHERE employee_id = $1
              AND status <> 'cancelled'
              AND date_from <= $3::date
              AND date_to >= $2::date
            ORDER BY date_from ASC, id ASC
            `,
            [employee.id, startIso, endIso]
        ),
    ]);

    const vacationDays = new Set<string>();
    for (const row of vacationRes.rows || []) {
        const rowFrom = parseDateOnly(row.date_from);
        const rowTo = parseDateOnly(row.date_to);
        if (!rowFrom || !rowTo) continue;
        const rangeFrom = rowFrom < start ? start : rowFrom;
        const rangeTo = rowTo > end ? end : rowTo;
        if (rangeFrom > rangeTo) continue;
        for (const day of enumerateDays(rangeFrom, rangeTo)) {
            vacationDays.add(formatIsoDate(day));
        }
    }

    const sickDays = new Set<string>();
    for (const row of scheduleRes.rows || []) {
        const day = parseDateOnly(row.day);
        const status = String(row.status || '').trim().toLowerCase();
        if (!day || !SICK_STATUSES.has(status)) continue;
        const key = formatIsoDate(day);
        if (vacationDays.has(key)) continue;
        sickDays.add(key);
    }

    const totalMonthDays = Math.max(enumerateDays(start, end).length, 1);
    const dailyRate = Number(employee.rate) / totalMonthDays;
    const vacationAmount = roundMoney(dailyRate * vacationDays.size);
    const sickLeaveAmount = roundMoney(dailyRate * sickDays.size);
    const salaryAmount = roundMoney(Math.max(0, Number(employee.rate) - vacationAmount - sickLeaveAmount));
    const bonusAmount = roundMoney(Number(source.accruals.bonus || 0));
    const otherIncomeAmount = roundMoney(Number(source.accruals.otherIncome || 0));
    const totalAccrued = roundMoney(salaryAmount + bonusAmount + sickLeaveAmount + vacationAmount + otherIncomeAmount);
    const incomeTax = roundMoney(totalAccrued * DEFAULT_TAX_RATE);
    const orgDebt = roundMoney(Number(source.accruals.orgDebt || 0));
    const employeeDebt = roundMoney(Number(source.accruals.employeeDebt || 0));
    const payable = roundMoney(totalAccrued - incomeTax + orgDebt - employeeDebt);

    return {
        salary: salaryAmount,
        bonus: bonusAmount,
        sickLeave: sickLeaveAmount,
        vacation: vacationAmount,
        otherIncome: otherIncomeAmount,
        totalAccrued,
        incomeTax,
        hospitalOffset: 0,
        advanceOffset: 0,
        orgDebt,
        employeeDebt,
        payable,
    };
};

const prepareStatementEntries = async (entries: StatementEntryPayload[]): Promise<StatementPreparedEntry[]> =>
    Promise.all(
        entries.map(async (entry) => ({
            ...entry,
            workedSummary: await getWorkedSummary(entry.employee.id, entry.source.periodFrom, entry.source.periodTo),
            accrualColumns: await getMonthlyStatementAccrualColumns(entry.employee, entry.source),
        }))
    );

const fillStatementEmployeeRow = (
    cells: StatementTemplateCell[],
    rowHeights: StatementTemplateRowHeight[],
    sheetName: string,
    row: number,
    ordinal: number,
    entry: StatementPreparedEntry
) => {
    const sourceLabel = getStatementSourceLabel(entry.source);
    const columns = entry.accrualColumns;

    pushCell(cells, sheetName, `A${row}`, ordinal);
    pushCell(cells, sheetName, `C${row}`, entry.employee.id);
    pushCell(
        cells,
        sheetName,
        `G${row}`,
        entry.employee.position || sourceLabel,
        compactTableFieldStyle()
    );
    pushCell(cells, sheetName, `M${row}`, entry.employee.rate == null ? '' : Number(entry.employee.rate));
    pushCell(
        cells,
        sheetName,
        `Q${row}`,
        formatWorkedCell(entry.workedSummary.workdayDays, entry.workedSummary.workdayHours),
        workedCellStyle()
    );
    pushCell(
        cells,
        sheetName,
        `S${row}`,
        formatWorkedCell(entry.workedSummary.weekendDays, entry.workedSummary.weekendHours),
        workedCellStyle()
    );
    pushCell(
        cells,
        sheetName,
        `U${row}`,
        formatWorkedCell(entry.workedSummary.holidayDays, entry.workedSummary.holidayHours),
        workedCellStyle()
    );
    pushCell(cells, sheetName, `W${row}`, formatMoney(columns.salary));
    pushCell(cells, sheetName, `AA${row}`, formatMoney(columns.bonus));
    pushCell(cells, sheetName, `AE${row}`, formatMoney(columns.sickLeave));
    pushCell(cells, sheetName, `AI${row}`, formatMoney(columns.vacation));
    pushCell(cells, sheetName, `AM${row}`, '0,00');
    pushCell(cells, sheetName, `AQ${row}`, formatMoney(columns.otherIncome));
    pushCell(cells, sheetName, `AU${row}`, formatMoney(columns.totalAccrued));
    pushCell(cells, sheetName, `AY${row}`, formatMoney(columns.incomeTax));
    pushCell(cells, sheetName, `BD${row}`, formatMoney(columns.hospitalOffset));
    pushCell(cells, sheetName, `BI${row}`, formatMoney(columns.advanceOffset));
    pushCell(cells, sheetName, `BN${row}`, '0,00');
    pushCell(cells, sheetName, `BS${row}`, formatMoney(columns.orgDebt));
    pushCell(cells, sheetName, `BY${row}`, formatMoney(columns.employeeDebt));
    pushCell(cells, sheetName, `CE${row}`, formatMoney(columns.payable));
    pushCell(
        cells,
        sheetName,
        `CK${row}`,
        toSurnameInitials(entry.employee.fio),
        compactTableFieldStyle()
    );
    pushRowHeight(rowHeights, sheetName, row, getEntryRowHeight(entry));
};

const fillStatementTotalRow = (
    cells: StatementTemplateCell[],
    sheetName: string,
    row: number,
    entries: StatementPreparedEntry[]
) => {
    const totals = entries.reduce(
        (acc, entry) => {
            const columns = entry.accrualColumns;
            acc.salary += columns.salary;
            acc.bonus += columns.bonus;
            acc.sickLeave += columns.sickLeave;
            acc.vacation += columns.vacation;
            acc.otherIncome += columns.otherIncome;
            acc.totalAccrued += columns.totalAccrued;
            acc.incomeTax += columns.incomeTax;
            acc.hospitalOffset += columns.hospitalOffset;
            acc.advanceOffset += columns.advanceOffset;
            acc.orgDebt += columns.orgDebt;
            acc.employeeDebt += columns.employeeDebt;
            acc.payable += columns.payable;
            return acc;
        },
        {
            salary: 0,
            bonus: 0,
            sickLeave: 0,
            vacation: 0,
            otherIncome: 0,
            totalAccrued: 0,
            incomeTax: 0,
            hospitalOffset: 0,
            advanceOffset: 0,
            orgDebt: 0,
            employeeDebt: 0,
            payable: 0,
        }
    );

    pushCell(cells, sheetName, `A${row}`, 'Итого');
    pushCell(cells, sheetName, `W${row}`, formatMoney(totals.salary));
    pushCell(cells, sheetName, `AA${row}`, formatMoney(totals.bonus));
    pushCell(cells, sheetName, `AE${row}`, formatMoney(totals.sickLeave));
    pushCell(cells, sheetName, `AI${row}`, formatMoney(totals.vacation));
    pushCell(cells, sheetName, `AQ${row}`, formatMoney(totals.otherIncome));
    pushCell(cells, sheetName, `AU${row}`, formatMoney(totals.totalAccrued));
    pushCell(cells, sheetName, `AY${row}`, formatMoney(totals.incomeTax));
    pushCell(cells, sheetName, `BD${row}`, formatMoney(totals.hospitalOffset));
    pushCell(cells, sheetName, `BI${row}`, formatMoney(totals.advanceOffset));
    pushCell(cells, sheetName, `BN${row}`, '0,00');
    pushCell(cells, sheetName, `BS${row}`, formatMoney(totals.orgDebt));
    pushCell(cells, sheetName, `BY${row}`, formatMoney(totals.employeeDebt));
    pushCell(cells, sheetName, `CE${row}`, formatMoney(totals.payable));
};

const prepareFinanceStatementTemplatePayload = async (params: {
    actor: StatementActor;
    entries: StatementEntryPayload[];
}): Promise<FinanceStatementTemplatePayload> => {
    const { actor, entries } = params;
    if (!entries.length) {
        throw new Error('Для расчетно-платежной ведомости не выбраны сотрудники');
    }
    if (entries.length > MAX_STATEMENT_EMPLOYEES) {
        throw new Error(`В одной ведомости поддерживается не более ${MAX_STATEMENT_EMPLOYEES} сотрудников`);
    }

    const preparedEntries = await prepareStatementEntries(entries);
    const firstEntry = preparedEntries[0];
    const paymentDate = parseDateOnly(firstEntry.source.paymentDate) || new Date();
    const statementMonthBase = parseDateOnly(firstEntry.source.periodFrom)
        || parseDateOnly(firstEntry.source.periodTo)
        || paymentDate;
    const reportPeriodFrom = startOfMonthUtc(statementMonthBase);
    const reportPeriodTo = endOfMonthUtc(statementMonthBase);
    const cashPeriodFrom = paymentDate;
    const cashPeriodTo = addDays(paymentDate, 4);
    const documentKey = buildDocumentKeyForEntries(preparedEntries);
    const statementNumber = await getStatementNumber(documentKey);
    const accountant = await getChiefAccountant();
    const template = await getDocumentTemplateDefinition(TEMPLATE_KEY);

    const statementAmount = roundMoney(preparedEntries.reduce((sum, entry) => sum + entry.accrualColumns.payable, 0));
    const depositedAmount = 0;
    const amountWords = numberToWordsWithoutCurrency(statementAmount);
    const statementParts = splitMoney(statementAmount);
    const depositedParts = splitMoney(depositedAmount);
    const paymentYearFull = String(paymentDate.getUTCFullYear());
    const paymentYearCentury = paymentYearFull.slice(0, 2);
    const paymentYearSuffix = paymentYearFull.slice(-2);
    const cashFromYearFull = String(cashPeriodFrom.getUTCFullYear());
    const cashFromYearCentury = cashFromYearFull.slice(0, 2);
    const cashFromYearSuffix = cashFromYearFull.slice(-2);
    const cashToYearFull = String(cashPeriodTo.getUTCFullYear());
    const cashToYearCentury = cashToYearFull.slice(0, 2);
    const cashToYearSuffix = cashToYearFull.slice(-2);
    const actorShort = toSurnameInitials(actor.fio);
    const accountantShort = toSurnameInitials(accountant?.fio || actor.fio);
    const monthYearLabel = formatMonthYearFileLabel(statementMonthBase);
    const employeeShortName = toSurnameInitials(firstEntry.employee.fio) || firstEntry.employee.fio || `employee-${firstEntry.employee.id}`;
    const baseName = preparedEntries.length === 1
        ? `Расчетно платежная ведомость ${employeeShortName} ${monthYearLabel}`.trim()
        : `Расчетно платежная ведомость ${monthYearLabel}`.trim();

    const cells: StatementTemplateCell[] = [];
    const rowVisibility: StatementTemplateRowVisibility[] = [];
    const rowHeights: StatementTemplateRowHeight[] = [];
    const printAreas: StatementTemplatePrintArea[] = [];
    const rangeCopies: StatementTemplateRangeCopy[] = [];
    const hiddenSheets: string[] = [];
    const sheetPageSetup: StatementTemplateSheetPageSetup[] = [];

    pushCell(cells, FIRST_SHEET_NAME, 'A6', ORGANIZATION_NAME, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'A7', STRUCTURAL_DIVISION, lineFieldStyle({
        fontSize: 9,
    }));
    // В шаблоне под ОКПО есть еще одна пустая строка с рамкой. Затираем ее
    // строкой без границ, чтобы справа остался только нужный блок кодов.
    pushRangeCopy(rangeCopies, FIRST_SHEET_NAME, 'CO8:CV8', FIRST_SHEET_NAME, 'CO7');
    pushCell(cells, FIRST_SHEET_NAME, 'CO6', OKPO_CODE);
    pushCell(cells, FIRST_SHEET_NAME, 'CO5', OKUD_CODE);
    pushCell(cells, FIRST_SHEET_NAME, 'L10', cashPeriodFrom.getUTCDate(), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'N10', formatMonthNameRuGenitive(cashPeriodFrom), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'T10', cashFromYearCentury, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'U10', cashFromYearSuffix, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'Z10', cashPeriodTo.getUTCDate(), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AB10', formatMonthNameRuGenitive(cashPeriodTo), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AH10', cashToYearCentury, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AI10', cashToYearSuffix, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'D11', amountWords, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AL11', statementParts.kopecks, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AP11', statementParts.rubles, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AV11', statementParts.kopecks, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'L14', actor.position || 'Директор', lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'AF14', actorShort, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'U16', accountantShort, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'B18', paymentDate.getUTCDate(), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'D18', formatMonthNameRuGenitive(paymentDate), lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'J18', paymentYearCentury, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'K18', paymentYearSuffix, lineFieldStyle());
    pushCell(cells, FIRST_SHEET_NAME, 'BI19', statementNumber);
    pushCell(cells, FIRST_SHEET_NAME, 'BQ19', formatDateOnly(paymentDate));
    pushCell(cells, FIRST_SHEET_NAME, 'CB19', formatDateOnly(reportPeriodFrom));
    pushCell(cells, FIRST_SHEET_NAME, 'CH19', formatDateOnly(reportPeriodTo));
    pushCell(cells, FIRST_SHEET_NAME, 'W23', 'заработная плата');
    pushCell(cells, FIRST_SHEET_NAME, 'AA23', 'премия');
    pushCell(cells, FIRST_SHEET_NAME, 'AE23', 'больничный');
    pushCell(cells, FIRST_SHEET_NAME, 'AI23', 'отпускные');
    pushCell(cells, SECOND_SHEET_NAME, 'W5', 'заработная плата');
    pushCell(cells, SECOND_SHEET_NAME, 'AA5', 'премия');
    pushCell(cells, SECOND_SHEET_NAME, 'AE5', 'больничный');
    pushCell(cells, SECOND_SHEET_NAME, 'AI5', 'отпускные');

    pushCell(cells, SECOND_SHEET_NAME, 'G32', amountWords, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AM32', statementParts.kopecks, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AQ32', statementParts.rubles, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AV32', statementParts.kopecks, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'BF32', accountant?.position || 'Главный бухгалтер', lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'BV32', accountantShort, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CQ32', statementNumber, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CI33', paymentDate.getUTCDate(), lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CK33', formatMonthNameRuGenitive(paymentDate), lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CQ33', paymentYearCentury, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CR33', paymentYearSuffix, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'H34', numberToWordsWithoutCurrency(depositedAmount), lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AM34', depositedParts.kopecks, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AQ34', depositedParts.rubles, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'AV34', depositedParts.kopecks, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'BO34', accountantShort, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CA36', paymentDate.getUTCDate(), lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CC36', formatMonthNameRuGenitive(paymentDate), lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CI36', paymentYearCentury, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CJ36', paymentYearSuffix, lineFieldStyle());
    pushCell(cells, SECOND_SHEET_NAME, 'CM36', '');

    pushRowHeight(rowHeights, FIRST_SHEET_NAME, 6, 16);
    pushRowHeight(rowHeights, FIRST_SHEET_NAME, 7, 16);
    pushRowHeight(rowHeights, FIRST_SHEET_NAME, 11, 14);
    pushRowHeight(rowHeights, FIRST_SHEET_NAME, 14, 14);
    pushRowHeight(rowHeights, FIRST_SHEET_NAME, 16, 14);
    pushRowHeight(rowHeights, SECOND_SHEET_NAME, 32, 14);
    pushRowHeight(rowHeights, SECOND_SHEET_NAME, 34, 14);

    const firstPageEntries = preparedEntries.slice(0, FIRST_SHEET_ROW_END - FIRST_SHEET_ROW_START + 1);
    const secondPageEntries = preparedEntries.slice(firstPageEntries.length);

    firstPageEntries.forEach((entry, index) => {
        fillStatementEmployeeRow(cells, rowHeights, FIRST_SHEET_NAME, FIRST_SHEET_ROW_START + index, index + 1, entry);
    });

    if (secondPageEntries.length > 0) {
        secondPageEntries.forEach((entry, index) => {
            fillStatementEmployeeRow(cells, rowHeights, SECOND_SHEET_NAME, SECOND_SHEET_ROW_START + index, firstPageEntries.length + index + 1, entry);
        });
    }

    if (secondPageEntries.length === 0) {
        pushHiddenRows(rowVisibility, FIRST_SHEET_NAME, FIRST_SHEET_ROW_START + firstPageEntries.length, FIRST_SHEET_ROW_END);
        fillStatementTotalRow(cells, FIRST_SHEET_NAME, FIRST_SHEET_TOTAL_ROW, preparedEntries);
        pushRangeCopy(rangeCopies, SECOND_SHEET_NAME, 'A30:CV30', FIRST_SHEET_NAME, 'A36');
        pushRangeCopy(rangeCopies, SECOND_SHEET_NAME, 'A31:CV38', FIRST_SHEET_NAME, 'A37');
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 36, 8);
        pushCell(cells, FIRST_SHEET_NAME, 'A37', 'По настоящей платежной ведомости');
        pushCell(cells, FIRST_SHEET_NAME, 'A38', 'выплачена сумма ');
        pushCell(cells, FIRST_SHEET_NAME, 'A40', 'и депонирована сумма');
        pushCell(cells, FIRST_SHEET_NAME, 'G38', amountWords, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AM38', statementParts.kopecks, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AQ38', statementParts.rubles, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AV38', statementParts.kopecks, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'BF38', accountant?.position || 'Главный бухгалтер', lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'BV38', accountantShort, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CQ38', statementNumber, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CI39', paymentDate.getUTCDate(), lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CK39', formatMonthNameRuGenitive(paymentDate), lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CQ39', paymentYearCentury, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CR39', paymentYearSuffix, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'H40', numberToWordsWithoutCurrency(depositedAmount), lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AM40', depositedParts.kopecks, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AQ40', depositedParts.rubles, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'AV40', depositedParts.kopecks, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'BO40', accountantShort, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CA42', paymentDate.getUTCDate(), lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CC42', formatMonthNameRuGenitive(paymentDate), lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CI42', paymentYearCentury, lineFieldStyle());
        pushCell(cells, FIRST_SHEET_NAME, 'CJ42', paymentYearSuffix, lineFieldStyle());
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 37, 12);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 38, 12);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 39, 12);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 40, 12);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 41, 11.25);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 42, 12.75);
        pushRowHeight(rowHeights, FIRST_SHEET_NAME, 44, 10.5);
        hiddenSheets.push(SECOND_SHEET_NAME);
        pushPrintArea(printAreas, FIRST_SHEET_NAME, 'A1:CV44');
        pushSheetPageSetup(sheetPageSetup, FIRST_SHEET_NAME, 1, 1);
    } else {
        fillStatementTotalRow(cells, SECOND_SHEET_NAME, SECOND_SHEET_TOTAL_ROW, preparedEntries);
        pushHiddenRows(
            rowVisibility,
            SECOND_SHEET_NAME,
            SECOND_SHEET_ROW_START + secondPageEntries.length,
            SECOND_SHEET_ROW_END
        );
        pushHiddenRows(rowVisibility, SECOND_SHEET_NAME, SECOND_SHEET_TOTAL_ROW + 1, 30);
        pushHiddenRows(rowVisibility, SECOND_SHEET_NAME, 37, 38);
        pushHiddenRows(rowVisibility, FIRST_SHEET_NAME, FIRST_SHEET_TOTAL_ROW, FIRST_SHEET_TOTAL_ROW + 1);
        pushPrintArea(printAreas, FIRST_SHEET_NAME, 'A1:CV34');
        pushPrintArea(printAreas, SECOND_SHEET_NAME, 'A3:CV36');
        pushSheetPageSetup(sheetPageSetup, FIRST_SHEET_NAME, 1, 1);
        pushSheetPageSetup(sheetPageSetup, SECOND_SHEET_NAME, 1, 1);
    }

    return {
        templateKey: template.key,
        templateName: template.templateName,
        fileBaseName: baseName,
        previewTitle: preparedEntries.length === 1
            ? `${firstEntry.employee.fio} · ${getStatementSourceLabel(firstEntry.source)}`
            : `Расчетно-платежная ведомость · ${preparedEntries.length} сотрудников`,
        pdfPostprocess: template.pdfPostprocess,
        cells,
        rowVisibility,
        rowHeights,
        printAreas,
        rangeCopies,
        sheetCopies: [],
        hiddenSheets,
        sheetPageSetup,
    };
};

export const buildFinanceStatementTemplatePayload = async (params: {
    employee: StatementEmployeePayload;
    actor: StatementActor;
    source: StatementSourcePayload;
}): Promise<FinanceStatementTemplatePayload> => prepareFinanceStatementTemplatePayload({
    actor: params.actor,
    entries: [{ employee: params.employee, source: params.source }],
});

export const buildFinanceStatementBatchTemplatePayload = async (params: {
    actor: StatementActor;
    entries: StatementEntryPayload[];
}): Promise<FinanceStatementTemplatePayload> => prepareFinanceStatementTemplatePayload(params);

export const buildFinanceStatementFiles = async (params: {
    employee: StatementEmployeePayload;
    actor: StatementActor;
    source: StatementSourcePayload;
}): Promise<StatementFiles> => {
    const templatePayload = await prepareFinanceStatementTemplatePayload({
        actor: params.actor,
        entries: [{ employee: params.employee, source: params.source }],
    });
    const template = await getDocumentTemplateDefinition(templatePayload.templateKey);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finance-statement-'));
    const excelPath = path.join(tempDir, `${templatePayload.fileBaseName}.xlsx`);
    const htmlPath = path.join(tempDir, `${templatePayload.fileBaseName}.html`);

    const workbook = XLSX.readFile(template.templatePath, {
        cellStyles: true,
        cellNF: true,
        cellDates: true,
    });

    const primarySheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!primarySheet) {
        throw new Error('Не найден лист в шаблоне расчетно-платежной ведомости');
    }

    templatePayload.cells.forEach(({ sheetName, address, value }) => {
        const targetSheetName = sheetName || workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheetName];
        if (!sheet) return;
        setCellValue(sheet, address, value);
    });

    templatePayload.rowVisibility.forEach(({ sheetName, row, hidden }) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const rows = (sheet['!rows'] ||= []);
        rows[row - 1] = {
            ...(rows[row - 1] || {}),
            hidden,
        };
    });

    templatePayload.rowHeights.forEach(({ sheetName, row, height }) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const rows = (sheet['!rows'] ||= []);
        rows[row - 1] = {
            ...(rows[row - 1] || {}),
            hpt: height,
        };
    });

    XLSX.writeFile(workbook, excelPath, {
        bookType: 'xlsx',
        cellStyles: true,
    });

    const html = buildPreviewHtml(primarySheet, templatePayload.previewTitle);
    await fs.writeFile(htmlPath, html, 'utf8');

    return {
        excelPath,
        htmlPath,
        fileBaseName: templatePayload.fileBaseName,
    };
};
