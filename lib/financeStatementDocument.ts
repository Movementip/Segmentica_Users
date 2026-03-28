import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import { getPool, query } from './db';

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
};

type WorkedSummary = {
    workdayDays: number;
    workdayHours: number;
    weekendDays: number;
    weekendHours: number;
    holidayDays: number;
    holidayHours: number;
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

const TEMPLATE_PATH = '/Users/ivandolgih/Downloads/Форма Т-49 Расчетно-платежная ведомость.xlsx';
const NUMBERING_SETTINGS_KEY = 'finance_statement_numbers';

const ORGANIZATION_NAME = 'ИП Юдин Роман Игоревич';
const STRUCTURAL_DIVISION = 'главный офис';
const OKPO_CODE = '95164141';
const OKUD_CODE = '0301009';

const WORKED_STATUSES = new Set([
    'работал',
    'работает',
    'удаленно',
    'удалённо',
    'командировка',
    'больничный',
]);

const numberFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const formatMoney = (value: number): string => numberFormatter.format(Number(value) || 0);

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

const slugify = (value: string): string =>
    String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();

const formatHours = (value: number): string => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};

const formatWorkedCell = (days: number, hours: number): string => `${days} (${formatHours(hours)})`;

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

    const [startHours, startMinutes] = start.split(':').map((part) => Number(part) || 0);
    const [endHours, endMinutes] = end.split(':').map((part) => Number(part) || 0);
    const totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    if (totalMinutes <= 0) return 8;
    return Math.round((totalMinutes / 60) * 100) / 100;
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

        const timeStart = String(schedule?.time_start || '').trim();
        const timeEnd = String(schedule?.time_end || '').trim();
        let hours = defaultShiftHours;
        if (timeStart && timeEnd) {
            const [startHours, startMinutes] = timeStart.split(':').map((part: string) => Number(part) || 0);
            const [endHours, endMinutes] = timeEnd.split(':').map((part: string) => Number(part) || 0);
            const totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
            if (totalMinutes > 0) {
                hours = Math.round((totalMinutes / 60) * 100) / 100;
            }
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
        SELECT "фио" AS fio, "должность" AS position
        FROM public."Сотрудники"
        WHERE COALESCE("активен", true) = true
          AND LOWER(COALESCE("должность", '')) LIKE '%бухгалтер%'
        ORDER BY id ASC
        LIMIT 1
        `
    );

    const row = res.rows?.[0];
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

export const buildFinanceStatementFiles = async (params: {
    employee: StatementEmployeePayload;
    actor: StatementActor;
    source: StatementSourcePayload;
}): Promise<StatementFiles> => {
    const { employee, actor, source } = params;
    const periodFromDate = parseDateOnly(source.periodFrom);
    const periodToDate = parseDateOnly(source.periodTo);
    const paymentDate = parseDateOnly(source.paymentDate) || new Date();
    const documentKey = buildDocumentKey(employee, source);
    const statementNumber = await getStatementNumber(documentKey);
    const accountant = await getChiefAccountant();
    const workedSummary = await getWorkedSummary(employee.id, source.periodFrom, source.periodTo);

    const payableAmount = Number(source.payableAmount || 0);
    const accruedAmount = Number(source.accruedAmount || 0);
    const withheldAmount = Number(source.withheldAmount || 0);
    const paymentDateText = formatDateOnly(paymentDate);
    const amountWords = numberToWordsRu(payableAmount);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'finance-statement-'));
    const employeeSlug = slugify(employee.fio || `employee-${employee.id}`) || `employee-${employee.id}`;
    const baseName = `raschetno-platezhnaya-vedomost-${String(statementNumber).padStart(4, '0')}-${employeeSlug}`;
    const excelPath = path.join(tempDir, `${baseName}.xlsx`);
    const htmlPath = path.join(tempDir, `${baseName}.html`);

    const workbook = XLSX.readFile(TEMPLATE_PATH, {
        cellStyles: true,
        cellNF: true,
        cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        throw new Error('Не найден лист в шаблоне расчетно-платежной ведомости');
    }

    const sourceLabel =
        source.paymentKind === 'advance'
            ? 'Аванс'
            : source.paymentKind === 'vacation'
                ? 'Отпускные'
                : source.paymentKind === 'bonus'
                    ? 'Премия'
                    : 'Зарплата';

    const row = 25;
    const totalRow = 35;
    const rowCells: Array<[string, string | number]> = [
        ['A7', ORGANIZATION_NAME],
        ['A8', STRUCTURAL_DIVISION],
        ['CK6', OKPO_CODE],
        ['CO5', OKUD_CODE],
        ['T10', paymentDateText.slice(8, 10)],
        ['AH10', paymentDateText.slice(8, 10)],
        ['D12', amountWords],
        ['AP12', formatMoney(payableAmount)],
        ['L15', actor.position || 'Директор'],
        ['AF15', actor.fio],
        ['U17', accountant?.fio || actor.fio],
        ['BI19', statementNumber],
        ['BQ19', formatDateOnly(new Date())],
        ['CB19', formatDateOnly(periodFromDate)],
        ['CH19', formatDateOnly(periodToDate)],
        [`A${row}`, 1],
        [`C${row}`, employee.id],
        [`G${row}`, employee.position || sourceLabel],
        [`M${row}`, employee.rate == null ? '' : Number(employee.rate)],
        [`Q${row}`, formatWorkedCell(workedSummary.workdayDays, workedSummary.workdayHours)],
        [`S${row}`, formatWorkedCell(workedSummary.weekendDays, workedSummary.weekendHours)],
        [`U${row}`, formatWorkedCell(workedSummary.holidayDays, workedSummary.holidayHours)],
        [`W${row}`, source.paymentKind === 'salary' ? formatMoney(accruedAmount) : '0,00'],
        [`AA${row}`, source.paymentKind === 'advance' ? formatMoney(accruedAmount) : '0,00'],
        [`AE${row}`, source.paymentKind === 'vacation' ? formatMoney(accruedAmount) : '0,00'],
        [`AI${row}`, source.paymentKind === 'bonus' ? formatMoney(accruedAmount) : '0,00'],
        [`AM${row}`, '0,00'],
        [`AQ${row}`, '0,00'],
        [`AU${row}`, formatMoney(accruedAmount)],
        [`AY${row}`, formatMoney(withheldAmount)],
        [`BD${row}`, '0,00'],
        [`BI${row}`, '0,00'],
        [`BN${row}`, formatMoney(withheldAmount)],
        [`BS${row}`, '0,00'],
        [`BY${row}`, '0,00'],
        [`CE${row}`, formatMoney(payableAmount)],
        [`CK${row}`, employee.fio],
        [`A${totalRow}`, 'Итого'],
        [`AU${totalRow}`, formatMoney(accruedAmount)],
        [`AY${totalRow}`, formatMoney(withheldAmount)],
        [`BN${totalRow}`, formatMoney(withheldAmount)],
        [`BS${totalRow}`, '0,00'],
        [`BY${totalRow}`, '0,00'],
        [`CE${totalRow}`, formatMoney(payableAmount)],
    ];

    if (source.comment) {
        rowCells.push(['A11', `${sourceLabel}: ${source.comment}`]);
    }

    rowCells.forEach(([cell, value]) => setCellValue(sheet, cell, value));

    XLSX.writeFile(workbook, excelPath, {
        bookType: 'xlsx',
        cellStyles: true,
    });

    const html = buildPreviewHtml(sheet, `${employee.fio} · ${sourceLabel}`);
    await fs.writeFile(htmlPath, html, 'utf8');

    return {
        excelPath,
        htmlPath,
        fileBaseName: baseName,
    };
};
