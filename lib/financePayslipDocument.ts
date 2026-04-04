import { query } from './db';
import { getDocumentTemplateDefinition } from './documentTemplates';
import type {
    FinanceStatementTemplatePayload,
    StatementEmployeePayload,
    StatementSourcePayload,
    StatementTemplateCell,
} from './financeStatementDocument';

type PayslipPaymentHistoryItem = {
    id: string;
    amount: number;
    date: string;
    paidAmount: number;
    accruedAmount?: number;
    withheldAmount?: number;
    payableAmount?: number;
    paymentKind: string | null;
    periodFrom: string | null;
    periodTo: string | null;
};

type PayslipContributionDetails = {
    taxableIncomeMonth: number;
    contributionBaseMonth: number;
    contributionYearBase30: number;
    contributionYearBase151: number;
};

type PayslipBuildParams = {
    employee: StatementEmployeePayload;
    source: StatementSourcePayload;
    paymentHistory: PayslipPaymentHistoryItem[];
    settings: {
        paymentsPerMonth: 1 | 2;
        firstDay: number;
        secondDay: number | null;
    };
    contributionDetails: PayslipContributionDetails;
    currentContributions: number;
    currentOrgDebt: number;
    currentEmployeeDebt: number;
};

type PayslipBatchEntry = PayslipBuildParams;

type PeriodSummary = {
    days: number;
    hours: number;
};

type RangeSummary = {
    count: number;
    dateFrom: Date | null;
    dateTo: Date | null;
};

type AccrualLine = {
    label: string;
    period: string;
    quantity: string;
    amount: number;
};

type DeductionLine = {
    label: string;
    amount: number;
};

type PaymentLine = {
    label: string;
    amount: number;
};

const TEMPLATE_KEY = 'finance_payslip' as const;
const ORGANIZATION_NAME = 'ООО «Сегментика»';
const DIVISION_NAME = 'Главный офис';

const WORKED_STATUSES = new Set([
    'работал',
    'работает',
    'удаленно',
    'удалённо',
    'командировка',
]);

const SICK_STATUSES = new Set(['больничный', 'больничный лист']);

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const hourFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const parseDateOnly = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
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

const formatIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const formatDateRu = (value: Date): string =>
    value.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    });

const formatMonthLabelRu = (value: Date): string => {
    const raw = value.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
    if (!raw) return `${value.getUTCMonth() + 1}.${value.getUTCFullYear()}`;
    return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

const formatMonthNameRu = (value: Date): string =>
    value.toLocaleDateString('ru-RU', {
        month: 'long',
        timeZone: 'UTC',
    });

const formatMonthYearFileLabel = (value: Date): string =>
    `${String(value.getUTCMonth() + 1).padStart(2, '0')}.${value.getUTCFullYear()}`;

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

const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

const formatMoneyRub = (value: number): string => `${moneyFormatter.format(roundMoney(value))} руб.`;

const formatBalance = (value: number): string => {
    const normalized = roundMoney(value);
    if (Math.abs(normalized) < 0.005) return '0';
    return moneyFormatter.format(normalized);
};

const formatCountOrDash = (days: number, hours: number): string => {
    const normalizedDays = Math.round(Number(days) || 0);
    const normalizedHours = roundMoney(hours);
    if (normalizedDays > 0) {
        return `${normalizedDays} дн.`;
    }
    if (normalizedHours > 0) {
        return `${hourFormatter.format(normalizedHours)} ч.`;
    }
    return '-';
};

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

const pushCell = (target: StatementTemplateCell[], address: string, value: string | number) => {
    target.push({ sheetName: 'Лист1', address, value });
};

const pushCellForSheet = (target: StatementTemplateCell[], sheetName: string, address: string, value: string | number) => {
    target.push({ sheetName, address, value });
};

const resolveMonthPeriod = (source: StatementSourcePayload): { monthDate: Date; periodFrom: Date; periodTo: Date } => {
    const periodFrom = parseDateOnly(source.periodFrom);
    const periodTo = parseDateOnly(source.periodTo);
    const paymentDate = parseDateOnly(source.paymentDate);
    const basis = periodFrom || periodTo || paymentDate || new Date();
    const monthDate = startOfMonthUtc(basis);
    return {
        monthDate,
        periodFrom: startOfMonthUtc(monthDate),
        periodTo: endOfMonthUtc(monthDate),
    };
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

const getWorkedSummaryForRange = async (employeeId: number, periodFrom: Date, periodTo: Date): Promise<PeriodSummary> => {
    const startIso = formatIsoDate(periodFrom);
    const endIso = formatIsoDate(periodTo);
    const defaultShiftHours = await getDefaultShiftHours(employeeId, startIso, endIso);
    const res = await query(
        `
        SELECT "статус" AS status, "время_начала" AS time_start, "время_окончания" AS time_end
        FROM public."График_работы"
        WHERE "сотрудник_id" = $1
          AND "дата" BETWEEN $2::date AND $3::date
        ORDER BY "дата" ASC
        `,
        [employeeId, startIso, endIso]
    );

    const summary: PeriodSummary = { days: 0, hours: 0 };
    for (const row of res.rows || []) {
        const status = String(row.status || '').trim().toLowerCase();
        if (!WORKED_STATUSES.has(status)) continue;
        const hours = calculateShiftHours(row.time_start, row.time_end) ?? defaultShiftHours;
        summary.days += 1;
        summary.hours += hours;
    }

    return {
        days: summary.days,
        hours: roundMoney(summary.hours),
    };
};

const getVacationSummaryForMonth = async (employeeId: number, periodFrom: Date, periodTo: Date): Promise<RangeSummary> => {
    const res = await query(
        `
        SELECT date_from, date_to
        FROM public.employee_vacations
        WHERE employee_id = $1
          AND status <> 'cancelled'
          AND date_from <= $3::date
          AND date_to >= $2::date
        ORDER BY date_from ASC, id ASC
        `,
        [employeeId, formatIsoDate(periodFrom), formatIsoDate(periodTo)]
    );

    let count = 0;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const row of res.rows || []) {
        const rowFrom = parseDateOnly(row.date_from);
        const rowTo = parseDateOnly(row.date_to);
        if (!rowFrom || !rowTo) continue;
        const rangeFrom = rowFrom < periodFrom ? periodFrom : rowFrom;
        const rangeTo = rowTo > periodTo ? periodTo : rowTo;
        if (rangeFrom > rangeTo) continue;
        const days = Math.floor((rangeTo.getTime() - rangeFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        count += days;
        minDate = !minDate || rangeFrom.getTime() < minDate.getTime() ? rangeFrom : minDate;
        maxDate = !maxDate || rangeTo.getTime() > maxDate.getTime() ? rangeTo : maxDate;
    }

    return { count, dateFrom: minDate, dateTo: maxDate };
};

const getSickSummaryForMonth = async (employeeId: number, periodFrom: Date, periodTo: Date): Promise<RangeSummary> => {
    const res = await query(
        `
        SELECT "дата" AS work_date, "статус" AS status
        FROM public."График_работы"
        WHERE "сотрудник_id" = $1
          AND "дата" BETWEEN $2::date AND $3::date
        ORDER BY "дата" ASC
        `,
        [employeeId, formatIsoDate(periodFrom), formatIsoDate(periodTo)]
    );

    const dates: Date[] = [];
    for (const row of res.rows || []) {
        const date = parseDateOnly(row.work_date);
        const status = String(row.status || '').trim().toLowerCase();
        if (!date || !SICK_STATUSES.has(status)) continue;
        dates.push(date);
    }

    return {
        count: dates.length,
        dateFrom: dates[0] || null,
        dateTo: dates[dates.length - 1] || null,
    };
};

const buildSalaryLines = async (
    employeeId: number,
    monthDate: Date,
    settings: PayslipBuildParams['settings'],
    advanceAmount: number,
    salaryAmount: number
): Promise<AccrualLine[]> => {
    const monthStart = startOfMonthUtc(monthDate);
    const monthEnd = endOfMonthUtc(monthDate);

    if (settings.paymentsPerMonth !== 2) {
        const summary = await getWorkedSummaryForRange(employeeId, monthStart, monthEnd);
        const combinedAmount = roundMoney(advanceAmount + salaryAmount);
        return combinedAmount > 0
            ? [{
                label: 'оклад',
                period: `${formatDateRu(monthStart).slice(0, 5)} - ${formatDateRu(monthEnd).slice(0, 5)}`,
                quantity: formatCountOrDash(summary.days, summary.hours),
                amount: combinedAmount,
            }]
            : [];
    }

    const middleDay = 15;
    const firstPeriodEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), middleDay));
    const secondPeriodStart = addDays(firstPeriodEnd, 1);

    const [firstSummary, secondSummary] = await Promise.all([
        getWorkedSummaryForRange(employeeId, monthStart, firstPeriodEnd),
        getWorkedSummaryForRange(employeeId, secondPeriodStart, monthEnd),
    ]);

    const lines: AccrualLine[] = [];
    if (advanceAmount > 0) {
        lines.push({
            label: 'оклад',
            period: `${formatDateRu(monthStart).slice(0, 5)} - ${formatDateRu(firstPeriodEnd).slice(0, 5)}`,
            quantity: formatCountOrDash(firstSummary.days, firstSummary.hours),
            amount: roundMoney(advanceAmount),
        });
    }

    if (salaryAmount > 0) {
        lines.push({
            label: 'зарплата',
            period: `${formatDateRu(secondPeriodStart).slice(0, 5)} - ${formatDateRu(monthEnd).slice(0, 5)}`,
            quantity: formatCountOrDash(secondSummary.days, secondSummary.hours),
            amount: roundMoney(salaryAmount),
        });
    }

    return lines;
};

const isRecordedMonthAggregateSource = (source: StatementSourcePayload): boolean =>
    source.key.startsWith('month-recorded#')
    || source.sourceSummary === 'Журнал выплат за выбранный месяц';

const getPaymentsForMonth = (
    paymentHistory: PayslipPaymentHistoryItem[],
    monthStart: Date,
    monthEnd: Date
): PayslipPaymentHistoryItem[] =>
    paymentHistory
        .filter((item) => {
            const paymentDate = parseDateOnly(item.date);
            const periodFrom = parseDateOnly(item.periodFrom);
            const periodTo = parseDateOnly(item.periodTo);

            if (periodFrom || periodTo) {
                const effectiveFrom = periodFrom || periodTo;
                const effectiveTo = periodTo || periodFrom;
                if (!effectiveFrom || !effectiveTo) return false;
                return effectiveFrom <= monthEnd && effectiveTo >= monthStart;
            }

            return Boolean(paymentDate && paymentDate >= monthStart && paymentDate <= addDays(monthEnd, 31));
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

const buildPaymentLines = (
    paymentHistory: PayslipPaymentHistoryItem[],
    monthStart: Date,
    monthEnd: Date
): PaymentLine[] => {
    const items = getPaymentsForMonth(paymentHistory, monthStart, monthEnd).map((item) => {
        const paymentDate = parseDateOnly(item.date);
        const amount = roundMoney(item.paidAmount || item.amount || 0);
        return {
            label: `По платежной ведомости от ${paymentDate ? formatDateRu(paymentDate) : String(item.date)} N ${item.id}`,
            amount,
        };
    });
    if (items.length <= 3) {
        return items;
    }

    const head = items.slice(0, 2);
    const restAmount = roundMoney(items.slice(2).reduce((sum, item) => sum + item.amount, 0));
    return [
        ...head,
        {
            label: 'Прочие выплаты за месяц',
            amount: restAmount,
        },
    ];
};

const buildFinancePayslipSheetCells = async (
    params: PayslipBuildParams,
    sheetName: string
): Promise<StatementTemplateCell[]> => {
    const { monthDate, periodFrom, periodTo } = resolveMonthPeriod(params.source);
    const accruals = params.source.accruals || {
        salary: params.source.accruedAmount,
        bonus: 0,
        sickLeave: 0,
        vacation: 0,
        otherIncome: 0,
        totalAccrued: params.source.accruedAmount,
        incomeTax: params.source.withheldAmount,
        hospitalOffset: 0,
        advanceOffset: 0,
        orgDebt: params.currentOrgDebt,
        employeeDebt: params.currentEmployeeDebt,
        payable: params.source.payableAmount,
    };

    const previousBalance = roundMoney(params.currentOrgDebt - params.currentEmployeeDebt);
    const salaryLines = await (isRecordedMonthAggregateSource(params.source)
        ? (() => {
            const amount = roundMoney(accruals.salary || 0);
            if (amount <= 0) return Promise.resolve([] as AccrualLine[]);
            return getWorkedSummaryForRange(params.employee.id, periodFrom, periodTo).then((summary) => ([{
                label: 'заработная плата',
                period: `${formatDateRu(periodFrom).slice(0, 5)} - ${formatDateRu(periodTo).slice(0, 5)}`,
                quantity: formatCountOrDash(summary.days, summary.hours),
                amount,
            }]));
        })()
        : buildSalaryLines(
            params.employee.id,
            monthDate,
            params.settings,
            roundMoney(accruals.advanceOffset || 0),
            roundMoney(accruals.salary || 0),
        ));
    const vacationSummary = await getVacationSummaryForMonth(params.employee.id, periodFrom, periodTo);
    const sickSummary = await getSickSummaryForMonth(params.employee.id, periodFrom, periodTo);

    const accrualLines: AccrualLine[] = [...salaryLines];
    if (roundMoney(accruals.bonus || 0) > 0) {
        accrualLines.push({
            label: 'ежемесячная премия',
            period: formatMonthNameRu(monthDate),
            quantity: '-',
            amount: roundMoney(accruals.bonus || 0),
        });
    }

    if (roundMoney(accruals.vacation || 0) > 0) {
        accrualLines.push({
            label: 'оплата отпуска',
            period: vacationSummary.dateFrom && vacationSummary.dateTo
                ? `${formatDateRu(vacationSummary.dateFrom).slice(0, 5)} - ${formatDateRu(vacationSummary.dateTo).slice(0, 5)}`
                : formatMonthNameRu(monthDate),
            quantity: vacationSummary.count > 0 ? `${vacationSummary.count} дн.` : '-',
            amount: roundMoney(accruals.vacation || 0),
        });
    }

    if (roundMoney(accruals.sickLeave || 0) > 0) {
        accrualLines.push({
            label: 'пособие по временной нетрудоспособности',
            period: sickSummary.dateFrom && sickSummary.dateTo
                ? `${formatDateRu(sickSummary.dateFrom).slice(0, 5)} - ${formatDateRu(sickSummary.dateTo).slice(0, 5)}`
                : formatMonthNameRu(monthDate),
            quantity: sickSummary.count > 0 ? `${sickSummary.count} дн.` : '-',
            amount: roundMoney(accruals.sickLeave || 0),
        });
    }

    if (roundMoney(accruals.otherIncome || 0) > 0) {
        accrualLines.push({
            label: 'прочие начисления',
            period: formatMonthNameRu(monthDate),
            quantity: '-',
            amount: roundMoney(accruals.otherIncome || 0),
        });
    }

    const limitedAccrualLines = accrualLines.slice(0, 5);
    const accrualRows = [20, 21, 22, 23, 24];
    const totalAccrued = roundMoney(params.source.accruedAmount || accruals.totalAccrued || limitedAccrualLines.reduce((sum, item) => sum + item.amount, 0));

    const deductionLines: DeductionLine[] = [];
    if (roundMoney(accruals.incomeTax || 0) > 0) {
        deductionLines.push({
            label: 'НДФЛ с начисленного дохода',
            amount: roundMoney(accruals.incomeTax || 0),
        });
    }

    const extraDeductions = roundMoney(params.source.withheldAmount - roundMoney(accruals.incomeTax || 0));
    if (extraDeductions > 0) {
        deductionLines.push({
            label: 'Прочие удержания',
            amount: extraDeductions,
        });
    }

    const totalWithheld = roundMoney(params.source.withheldAmount || deductionLines.reduce((sum, item) => sum + item.amount, 0));
    const monthPayable = roundMoney(
        params.source.payableAmount || accruals.payable || (totalAccrued - totalWithheld + roundMoney(accruals.orgDebt || 0) - roundMoney(accruals.employeeDebt || 0))
    );
    const totalPayable = roundMoney(previousBalance + monthPayable);
    const paymentsForMonth = getPaymentsForMonth(params.paymentHistory, periodFrom, periodTo);
    const paymentLines = buildPaymentLines(params.paymentHistory, periodFrom, periodTo);
    const totalPaid = roundMoney(paymentsForMonth.reduce((sum, item) => sum + roundMoney(item.paidAmount || item.amount || 0), 0));
    const currentBalance = roundMoney(totalPayable - totalPaid);
    const yearIncome = roundMoney(
        Number(params.contributionDetails.contributionYearBase30 || 0) + Number(params.contributionDetails.contributionYearBase151 || 0)
    );

    const cells: StatementTemplateCell[] = [];
    pushCellForSheet(cells, sheetName, 'C2', ORGANIZATION_NAME);
    pushCellForSheet(cells, sheetName, 'C4', `${DIVISION_NAME}${params.employee.position ? `, ${params.employee.position}` : ''}`);
    pushCellForSheet(cells, sheetName, 'C6', params.employee.fio);
    pushCellForSheet(cells, sheetName, 'H6', String(params.employee.id).padStart(3, '0'));
    pushCellForSheet(cells, sheetName, 'C8', params.employee.rate != null ? formatMoneyRub(params.employee.rate) : '-');
    pushCellForSheet(cells, sheetName, 'C13', formatMonthLabelRu(monthDate));
    pushCellForSheet(cells, sheetName, 'F15', formatBalance(previousBalance));
    pushCellForSheet(cells, sheetName, 'C17', formatMoneyRub(totalAccrued));

    accrualRows.forEach((row, index) => {
        const item = limitedAccrualLines[index];
        pushCellForSheet(cells, sheetName, `A${row}`, item?.label || '-');
        pushCellForSheet(cells, sheetName, `D${row}`, item?.period || '-');
        pushCellForSheet(cells, sheetName, `E${row}`, item?.quantity || '-');
        pushCellForSheet(cells, sheetName, `F${row}`, item ? formatMoneyRub(item.amount) : '-');
    });

    pushCellForSheet(cells, sheetName, 'C27', formatMoneyRub(totalWithheld));
    pushCellForSheet(cells, sheetName, 'A29', deductionLines[0] ? 'НДФЛ' : '-');
    pushCellForSheet(cells, sheetName, 'D29', deductionLines[0] ? formatMoneyRub(deductionLines[0].amount) : '-');
    pushCellForSheet(cells, sheetName, 'A30', deductionLines[1]?.label || '-');
    pushCellForSheet(cells, sheetName, 'D30', deductionLines[1] ? formatMoneyRub(deductionLines[1].amount) : '-');

    pushCellForSheet(cells, sheetName, 'A32', `Общая сумма, подлежащая выплате за ${formatMonthNameRu(monthDate)}`);
    pushCellForSheet(cells, sheetName, 'F32', formatMoneyRub(totalPayable));

    pushCellForSheet(cells, sheetName, 'C34', formatMoneyRub(totalPaid));
    pushCellForSheet(cells, sheetName, 'A35', paymentLines[0]?.label || '-');
    pushCellForSheet(cells, sheetName, 'D35', paymentLines[0] ? formatMoneyRub(paymentLines[0].amount) : '-');
    pushCellForSheet(cells, sheetName, 'A37', paymentLines[1]?.label || '-');
    pushCellForSheet(cells, sheetName, 'D37', paymentLines[1] ? formatMoneyRub(paymentLines[1].amount) : '-');
    pushCellForSheet(cells, sheetName, 'A39', paymentLines[2]?.label || 'В натуральной форме');
    pushCellForSheet(cells, sheetName, 'D39', paymentLines[2] ? formatMoneyRub(paymentLines[2].amount) : '-');
    pushCellForSheet(cells, sheetName, 'F41', formatBalance(currentBalance));
    pushCellForSheet(cells, sheetName, 'D44', formatMoneyRub(yearIncome));
    pushCellForSheet(cells, sheetName, 'D45', formatMoneyRub(params.currentContributions));

    return cells;
};

export const buildFinancePayslipTemplatePayload = async (
    params: PayslipBuildParams
): Promise<FinanceStatementTemplatePayload> => {
    const template = await getDocumentTemplateDefinition(TEMPLATE_KEY);
    const monthDate = resolveMonthPeriod(params.source).monthDate;
    const cells = await buildFinancePayslipSheetCells(params, 'Лист1');

    return {
        templateKey: template.key,
        templateName: template.templateName,
        fileBaseName: `Расчетный листок ${toSurnameInitials(params.employee.fio) || params.employee.fio} ${formatMonthYearFileLabel(monthDate)}`.trim(),
        previewTitle: 'Предпросмотр 1 документа',
        pdfPostprocess: template.pdfPostprocess,
        cells,
        rowVisibility: [],
        rowHeights: [],
        printAreas: [{ sheetName: 'Лист1', range: 'A1:I45' }],
        rangeCopies: [],
        sheetCopies: [],
        hiddenSheets: [],
        sheetPageSetup: [{ sheetName: 'Лист1', fitToWidth: 1, fitToHeight: 1 }],
    };
};

export const buildFinancePayslipBatchTemplatePayload = async (
    entries: PayslipBatchEntry[]
): Promise<FinanceStatementTemplatePayload> => {
    const template = await getDocumentTemplateDefinition(TEMPLATE_KEY);
    const cells: StatementTemplateCell[] = [];
    const printAreas: FinanceStatementTemplatePayload['printAreas'] = [];
    const sheetPageSetup: FinanceStatementTemplatePayload['sheetPageSetup'] = [];
    const sheetCopies: Array<{ sourceSheetName: string; targetSheetName: string }> = [];

    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const sheetName = index === 0 ? 'Лист1' : `Лист${index + 1}`;
        if (index > 0) {
            sheetCopies.push({ sourceSheetName: 'Лист1', targetSheetName: sheetName });
        }
        cells.push(...await buildFinancePayslipSheetCells(entry, sheetName));
        printAreas.push({ sheetName, range: 'A1:I45' });
        sheetPageSetup.push({ sheetName, fitToWidth: 1, fitToHeight: 1 });
    }

    const monthDate = resolveMonthPeriod(entries[0].source).monthDate;

    return {
        templateKey: template.key,
        templateName: template.templateName,
        fileBaseName: `Расчетные листки ${formatMonthYearFileLabel(monthDate)}`.trim(),
        previewTitle: `Предпросмотр ${entries.length} документов`,
        pdfPostprocess: template.pdfPostprocess,
        cells,
        rowVisibility: [],
        rowHeights: [],
        printAreas,
        rangeCopies: [],
        sheetCopies,
        hiddenSheets: [],
        sheetPageSetup,
    };
};
