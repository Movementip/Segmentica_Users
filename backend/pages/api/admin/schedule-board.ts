import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

type EmployeeRow = {
    id: number;
    fio: string;
    position: string;
    isActive: boolean;
};

type ScheduleBoardDay = {
    date: string;
    dayNumber: number;
    weekdayShort: string;
    isWeekend: boolean;
    isToday: boolean;
};

type ScheduleBoardCell = {
    date: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
    source: string;
    isOverride: boolean;
    isVirtual: boolean;
};

type ScheduleBoardEmployee = {
    id: number;
    fio: string;
    position: string;
    isActive: boolean;
    cells: ScheduleBoardCell[];
};

type ScheduleBoardResponse =
    | {
        month: string;
        monthLabel: string;
        visibleDateFrom: string;
        visibleDateTo: string;
        days: ScheduleBoardDay[];
        employees: ScheduleBoardEmployee[];
    }
    | { error: string };

type CalendarRow = {
    day: string;
    is_workday: boolean;
    is_holiday: boolean;
    is_shortened: boolean;
};

type PatternRow = {
    id: number;
    employee_id: number;
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
    id: number;
    employee_id: number;
    date_from: string;
    date_to: string;
};

type ExplicitScheduleItem = {
    employeeId: number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    source: string;
    isOverride: boolean;
};

type ResolvedScheduleItem = {
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    source: string;
    isOverride: boolean;
    isVirtual: boolean;
};

const parseMonthKey = (value: string | string[] | undefined) => {
    const raw = String(Array.isArray(value) ? value[0] : value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(raw)) {
        const now = new Date();
        return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
    }
    return raw;
};

const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
};

const diffInDays = (left: Date, right: Date) => {
    const utcLeft = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
    const utcRight = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
    return Math.floor((utcLeft - utcRight) / 86400000);
};

const subtractHour = (timeValue: string | null) => {
    if (!timeValue) return null;
    const [hoursRaw, minutesRaw] = timeValue.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return timeValue;
    const date = new Date(2000, 0, 1, hours, minutes, 0, 0);
    date.setHours(date.getHours() - 1);
    return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
};

const buildCalendarMap = (rows: CalendarRow[]) => {
    const map = new Map<string, CalendarRow>();
    for (const row of rows) {
        map.set(String(row.day).slice(0, 10), row);
    }
    return map;
};

const buildResolvedItems = (
    visibleDateFrom: Date,
    visibleDateTo: Date,
    explicitItems: ResolvedScheduleItem[],
    calendarRows: CalendarRow[],
    patterns: PatternRow[],
    vacations: VacationRow[]
): ResolvedScheduleItem[] => {
    const explicitMap = new Map<string, ResolvedScheduleItem>();
    for (const item of explicitItems) {
        explicitMap.set(item.date, item);
    }

    const calendarMap = buildCalendarMap(calendarRows);
    const vacationMap = new Map<string, VacationRow>();
    for (const vacation of vacations) {
        let cursor = new Date(vacation.date_from);
        const end = new Date(vacation.date_to);
        while (cursor <= end) {
            vacationMap.set(formatDateKey(cursor), vacation);
            cursor = addDays(cursor, 1);
        }
    }

    const resolved: ResolvedScheduleItem[] = [];
    let cursor = new Date(visibleDateFrom);

    while (cursor <= visibleDateTo) {
        const dateKey = formatDateKey(cursor);
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
            });
            cursor = addDays(cursor, 1);
            continue;
        }

        if (explicit) {
            resolved.push(explicit);
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
            const cycleIndex = ((diffInDays(cursor, anchorDate) % cycleLength) + cycleLength) % cycleLength;
            const cycleValue = applicablePattern.cycle_schema[cycleIndex];
            const weekendFallback = ((cursor.getDay() + 6) % 7) >= 5;
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
                                : applicablePattern.shift_end
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
        }

        cursor = addDays(cursor, 1);
    }

    return resolved;
};

const formatMonthLabel = (monthKey: string) => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return monthKey;
    }
    return new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ScheduleBoardResponse>
) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    const canViewBoard = Boolean(
        hasPermission(actor, 'admin.schedule_board')
        || (hasPermission(actor, 'managers.list') && hasPermission(actor, 'schedule.manage'))
    );

    if (!canViewBoard) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    try {
        const monthKey = parseMonthKey(req.query.month);
        const includeInactive = String(req.query.includeInactive || '').trim() === '1';
        const [yearRaw, monthRaw] = monthKey.split('-');
        const year = Number(yearRaw);
        const month = Number(monthRaw);

        const visibleDateFrom = new Date(year, month - 1, 1);
        const visibleDateTo = new Date(year, month, 0);
        const dateFromKey = formatDateKey(visibleDateFrom);
        const dateToKey = formatDateKey(visibleDateTo);

        const employeesResult = await query(
            `
                SELECT
                    id,
                    "фио",
                    COALESCE("должность", '') AS "должность",
                    COALESCE("активен", true) AS "активен"
                FROM "Сотрудники"
                WHERE ($1::boolean = true OR COALESCE("активен", true) = true)
                ORDER BY "активен" DESC, "фио" ASC
            `,
            [includeInactive]
        );

        const employees = employeesResult.rows.map((row: any) => ({
            id: Number(row.id),
            fio: String(row.фио || ''),
            position: String(row.должность || ''),
            isActive: Boolean(row.активен),
        })) satisfies EmployeeRow[];

        if (employees.length === 0) {
            res.status(200).json({
                month: monthKey,
                monthLabel: formatMonthLabel(monthKey),
                visibleDateFrom: dateFromKey,
                visibleDateTo: dateToKey,
                days: [],
                employees: [],
            });
            return;
        }

        const employeeIds = employees.map((employee) => employee.id);

        const [itemsResult, calendarResult, patternsResult] = await Promise.all([
            query(
                `
                    SELECT
                        "сотрудник_id",
                        id,
                        TO_CHAR("дата", 'YYYY-MM-DD') AS "дата",
                        "время_начала",
                        "время_окончания",
                        COALESCE("статус", 'Работал') AS статус,
                        COALESCE(source, 'manual') AS source,
                        COALESCE(is_override, false) AS is_override
                    FROM "График_работы"
                    WHERE "сотрудник_id" = ANY($1::int[])
                      AND "дата" BETWEEN $2 AND $3
                    ORDER BY "сотрудник_id" ASC, "дата" ASC, "время_начала" ASC NULLS LAST, id ASC
                `,
                [employeeIds, dateFromKey, dateToKey]
            ),
            query(
                `
                    SELECT
                        TO_CHAR(day, 'YYYY-MM-DD') AS day,
                        is_workday,
                        is_holiday,
                        is_shortened
                    FROM public.production_calendar_days
                    WHERE day BETWEEN $1 AND $2
                    ORDER BY day ASC
                `,
                [dateFromKey, dateToKey]
            ),
            query(
                `
                    SELECT
                        employee_id,
                        id,
                        cycle_schema,
                        TO_CHAR(anchor_date, 'YYYY-MM-DD') AS anchor_date,
                        TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
                        CASE
                            WHEN date_to IS NULL THEN NULL
                            ELSE TO_CHAR(date_to, 'YYYY-MM-DD')
                        END AS date_to,
                        shift_start,
                        shift_end,
                        respect_production_calendar,
                        shorten_preholiday
                    FROM public.employee_schedule_patterns
                    WHERE employee_id = ANY($1::int[])
                      AND is_active = true
                      AND date_from <= $3
                      AND COALESCE(date_to, DATE '9999-12-31') >= $2
                    ORDER BY employee_id ASC, date_from DESC, id DESC
                `,
                [employeeIds, dateFromKey, dateToKey]
            ),
        ]);

        let vacationRows: VacationRow[] = [];
        try {
            const vacationsResult = await query(
                `
                    SELECT
                        employee_id,
                        id,
                        TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
                        TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to
                    FROM public.employee_vacations
                    WHERE employee_id = ANY($1::int[])
                      AND date_from <= $3
                      AND date_to >= $2
                    ORDER BY employee_id ASC, date_from ASC, id ASC
                `,
                [employeeIds, dateFromKey, dateToKey]
            );

            vacationRows = vacationsResult.rows.map((row: any) => ({
                id: Number(row.id),
                employee_id: Number(row.employee_id),
                date_from: String(row.date_from || ''),
                date_to: String(row.date_to || ''),
            }));
        } catch (error: any) {
            if (error?.code !== '42P01') {
                throw error;
            }
        }

        const explicitItemsByEmployee = new Map<number, ResolvedScheduleItem[]>();
        for (const row of itemsResult.rows) {
            const employeeId = Number(row.сотрудник_id);
            const list = explicitItemsByEmployee.get(employeeId) ?? [];
            list.push({
                date: String(row.дата || ''),
                startTime: row.время_начала ? String(row.время_начала).slice(0, 5) : null,
                endTime: row.время_окончания ? String(row.время_окончания).slice(0, 5) : null,
                status: String(row.статус || 'Работал'),
                source: String(row.source || 'manual'),
                isOverride: Boolean(row.is_override),
                isVirtual: false,
            });
            explicitItemsByEmployee.set(employeeId, list);
        }

        const patternsByEmployee = new Map<number, PatternRow[]>();
        for (const row of patternsResult.rows as any[]) {
            const employeeId = Number(row.employee_id);
            const list = patternsByEmployee.get(employeeId) ?? [];
            list.push({
                employee_id: employeeId,
                id: Number(row.id),
                cycle_schema: Array.isArray(row.cycle_schema) ? row.cycle_schema : [],
                anchor_date: String(row.anchor_date || ''),
                date_from: String(row.date_from || ''),
                date_to: row.date_to ? String(row.date_to) : null,
                shift_start: row.shift_start ? String(row.shift_start).slice(0, 5) : null,
                shift_end: row.shift_end ? String(row.shift_end).slice(0, 5) : null,
                respect_production_calendar: Boolean(row.respect_production_calendar),
                shorten_preholiday: Boolean(row.shorten_preholiday),
            });
            patternsByEmployee.set(employeeId, list);
        }

        const vacationsByEmployee = new Map<number, VacationRow[]>();
        for (const row of vacationRows) {
            const list = vacationsByEmployee.get(row.employee_id) ?? [];
            list.push(row);
            vacationsByEmployee.set(row.employee_id, list);
        }

        const calendarRows = calendarResult.rows as CalendarRow[];
        const days: ScheduleBoardDay[] = [];
        let cursor = new Date(visibleDateFrom);
        const todayKey = formatDateKey(new Date());
        while (cursor <= visibleDateTo) {
            const dayKey = formatDateKey(cursor);
            const weekendFallback = ((cursor.getDay() + 6) % 7) >= 5;
            const calendarInfo = calendarRows.find((item) => String(item.day).slice(0, 10) === dayKey);
            days.push({
                date: dayKey,
                dayNumber: cursor.getDate(),
                weekdayShort: cursor.toLocaleDateString('ru-RU', { weekday: 'short' }),
                isWeekend: calendarInfo ? !calendarInfo.is_workday : weekendFallback,
                isToday: dayKey === todayKey,
            });
            cursor = addDays(cursor, 1);
        }

        const boardEmployees: ScheduleBoardEmployee[] = employees.map((employee) => {
            const resolvedItems = buildResolvedItems(
                visibleDateFrom,
                visibleDateTo,
                explicitItemsByEmployee.get(employee.id) ?? [],
                calendarRows,
                patternsByEmployee.get(employee.id) ?? [],
                vacationsByEmployee.get(employee.id) ?? []
            );
            const resolvedMap = new Map(resolvedItems.map((item) => [item.date, item]));

            return {
                id: employee.id,
                fio: employee.fio,
                position: employee.position,
                isActive: employee.isActive,
                cells: days.map((day) => {
                    const item = resolvedMap.get(day.date);
                    return {
                        date: day.date,
                        status: item?.status || '__empty__',
                        startTime: item?.startTime || null,
                        endTime: item?.endTime || null,
                        source: item?.source || 'none',
                        isOverride: Boolean(item?.isOverride),
                        isVirtual: Boolean(item?.isVirtual),
                    };
                }),
            };
        });

        res.status(200).json({
            month: monthKey,
            monthLabel: formatMonthLabel(monthKey),
            visibleDateFrom: dateFromKey,
            visibleDateTo: dateToKey,
            days,
            employees: boardEmployees,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось загрузить сводный график сотрудников',
        });
    }
}
