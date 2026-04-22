import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { query } from '../../../../lib/db';

type ScheduleItem = {
    id: number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    source: string;
    patternId: number | null;
    isOverride: boolean;
    isVirtual?: boolean;
};

type ScheduleResponse =
    | {
        employeeId: number;
        month: string;
        visibleDateFrom: string;
        visibleDateTo: string;
        canEdit: boolean;
        canApplyPattern: boolean;
        items: ScheduleItem[];
    }
    | { ok: true; item: ScheduleItem | null }
    | { error: string };

const VALID_DB_STATUSES = new Set(['Работал', 'отпуск', 'больничный', 'командировка', 'работа на выезде']);

type CalendarRow = {
    day: string;
    is_workday: boolean;
    is_holiday: boolean;
    is_shortened: boolean;
};

type PatternRow = {
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
    id: number;
    date_from: string;
    date_to: string;
};

const parseEmployeeId = (value: string | string[] | undefined) => {
    const raw = Array.isArray(value) ? value[0] : value;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
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

const normalizeTimeValue = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return /^\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.slice(0, 5) : null;
};

const normalizeStatusValue = (value: unknown): string | null => {
    const raw = String(value || '').trim();
    if (!raw || raw === '__off__' || raw === 'Выходной') return null;
    if (raw === 'Отпуск') return 'отпуск';
    if (raw === 'Больничный') return 'больничный';
    if (raw === 'Командировка') return 'командировка';
    if (raw === 'Работа на выезде') return 'работа на выезде';
    if (VALID_DB_STATUSES.has(raw)) return raw;
    return null;
};

const toScheduleItem = (row: any): ScheduleItem => ({
    id: Number(row.id),
    date: row.дата ? String(row.дата).slice(0, 10) : '',
    startTime: row.время_начала ? String(row.время_начала).slice(0, 5) : null,
    endTime: row.время_окончания ? String(row.время_окончания).slice(0, 5) : null,
    status: String(row.статус || 'Работал'),
    source: String(row.source || 'manual'),
    patternId: row.pattern_id == null ? null : Number(row.pattern_id),
    isOverride: Boolean(row.is_override),
    isVirtual: false,
});

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
    explicitItems: ScheduleItem[],
    calendarRows: CalendarRow[],
    patterns: PatternRow[],
    vacations: VacationRow[]
): ScheduleItem[] => {
    const explicitMap = new Map<string, ScheduleItem>();
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

    const resolved: ScheduleItem[] = [];
    let cursor = new Date(visibleDateFrom);

    while (cursor <= visibleDateTo) {
        const dateKey = formatDateKey(cursor);
        const vacation = vacationMap.get(dateKey);
        const explicit = explicitMap.get(dateKey);

        if (vacation) {
            resolved.push({
                id: 0,
                date: dateKey,
                startTime: null,
                endTime: null,
                status: 'отпуск',
                source: 'vacation',
                patternId: null,
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
                    id: 0,
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
                    patternId: Number(applicablePattern.id),
                    isOverride: false,
                    isVirtual: true,
                });
            } else {
                resolved.push({
                    id: 0,
                    date: dateKey,
                    startTime: null,
                    endTime: null,
                    status: '__off__',
                    source: 'pattern',
                    patternId: Number(applicablePattern.id),
                    isOverride: false,
                    isVirtual: true,
                });
            }

            cursor = addDays(cursor, 1);
            continue;
        }

        if (calendarInfo && !calendarInfo.is_workday) {
            resolved.push({
                id: 0,
                date: dateKey,
                startTime: null,
                endTime: null,
                status: '__off__',
                source: 'calendar',
                patternId: null,
                isOverride: false,
                isVirtual: true,
            });
        }

        cursor = addDays(cursor, 1);
    }

    return resolved;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ScheduleResponse>) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    const employeeId = parseEmployeeId(req.query.id);
    if (!employeeId) {
        res.status(400).json({ error: 'Некорректный ID сотрудника' });
        return;
    }

    const isOwnSchedule = actor.employee.id === employeeId;
    const canRead = hasPermission(actor, 'managers.view') || isOwnSchedule;
    const canManageSchedule = hasPermission(actor, 'schedule.manage') || hasPermission(actor, 'managers.edit');
    const canEdit = canManageSchedule || (isOwnSchedule && hasPermission(actor, 'schedule.self.edit'));
    const canApplyPattern = canManageSchedule || (isOwnSchedule && hasPermission(actor, 'schedule.self.apply_pattern'));

    if (!canRead) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    if (req.method === 'GET') {
        try {
            const monthKey = parseMonthKey(req.query.month);
            const [yearRaw, monthRaw] = monthKey.split('-');
            const year = Number(yearRaw);
            const month = Number(monthRaw);
            const firstDayOfMonth = new Date(year, month - 1, 1);
            const lastDayOfMonth = new Date(year, month, 0);
            const leadingDays = (firstDayOfMonth.getDay() + 6) % 7;
            const trailingDays = 6 - ((lastDayOfMonth.getDay() + 6) % 7);
            const visibleDateFrom = new Date(year, month - 1, 1 - leadingDays);
            const visibleDateTo = new Date(year, month - 1, lastDayOfMonth.getDate() + trailingDays);

            const [itemsResult, calendarResult, patternsResult] = await Promise.all([
                query(
                    `
                        SELECT
                            id,
                            TO_CHAR("дата", 'YYYY-MM-DD') AS "дата",
                            "время_начала",
                            "время_окончания",
                            COALESCE("статус", 'Работал') AS статус,
                            COALESCE(source, 'manual') AS source,
                            pattern_id,
                            COALESCE(is_override, false) AS is_override
                        FROM "График_работы"
                        WHERE "сотрудник_id" = $1
                          AND "дата" BETWEEN $2 AND $3
                        ORDER BY "дата" ASC, "время_начала" ASC NULLS LAST, id ASC
                    `,
                    [employeeId, formatDateKey(visibleDateFrom), formatDateKey(visibleDateTo)]
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
                    [formatDateKey(visibleDateFrom), formatDateKey(visibleDateTo)]
                ),
                query(
                    `
                        SELECT
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
                        WHERE employee_id = $1
                          AND is_active = true
                          AND date_from <= $3
                          AND COALESCE(date_to, DATE '9999-12-31') >= $2
                        ORDER BY date_from DESC, id DESC
                    `,
                    [employeeId, formatDateKey(visibleDateFrom), formatDateKey(visibleDateTo)]
                ),
            ]);

            let vacationRows: VacationRow[] = [];
            try {
                const vacationsResult = await query(
                    `
                        SELECT
                            id,
                            TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from,
                            TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to
                        FROM public.employee_vacations
                        WHERE employee_id = $1
                          AND date_from <= $3
                          AND date_to >= $2
                        ORDER BY date_from ASC, id ASC
                    `,
                    [employeeId, formatDateKey(visibleDateFrom), formatDateKey(visibleDateTo)]
                );

                vacationRows = vacationsResult.rows.map((row: any) => ({
                    id: Number(row.id),
                    date_from: String(row.date_from || ''),
                    date_to: String(row.date_to || ''),
                }));
            } catch (error: any) {
                if (error?.code !== '42P01') {
                    throw error;
                }
            }

            const explicitItems = itemsResult.rows.map(toScheduleItem);
            const items = buildResolvedItems(
                visibleDateFrom,
                visibleDateTo,
                explicitItems,
                calendarResult.rows as CalendarRow[],
                (patternsResult.rows as any[]).map((row) => ({
                    ...row,
                    id: Number(row.id),
                    cycle_schema: Array.isArray(row.cycle_schema) ? row.cycle_schema : [],
                    anchor_date: String(row.anchor_date || ''),
                    date_from: String(row.date_from || ''),
                    date_to: row.date_to ? String(row.date_to) : null,
                    shift_start: row.shift_start ? String(row.shift_start).slice(0, 5) : null,
                    shift_end: row.shift_end ? String(row.shift_end).slice(0, 5) : null,
                    respect_production_calendar: Boolean(row.respect_production_calendar),
                    shorten_preholiday: Boolean(row.shorten_preholiday),
                })),
                vacationRows
            );

            res.status(200).json({
                employeeId,
                month: monthKey,
                visibleDateFrom: formatDateKey(visibleDateFrom),
                visibleDateTo: formatDateKey(visibleDateTo),
                canEdit,
                canApplyPattern,
                items,
            });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось загрузить график работы' });
        }
        return;
    }

    if (req.method === 'PUT') {
        if (!canEdit) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        try {
            const date = String(req.body?.date || '').trim();
            const status = normalizeStatusValue(req.body?.status);
            const startTime = normalizeTimeValue(req.body?.startTime);
            const endTime = normalizeTimeValue(req.body?.endTime);

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                res.status(400).json({ error: 'Некорректная дата графика' });
                return;
            }

            if (startTime && endTime && startTime >= endTime) {
                res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
                return;
            }

            if (!status) {
                await query(
                    'DELETE FROM "График_работы" WHERE "сотрудник_id" = $1 AND "дата" = $2',
                    [employeeId, date]
                );

                res.status(200).json({ ok: true, item: null });
                return;
            }

            const result = await query(
                `
                    INSERT INTO "График_работы" (
                        "сотрудник_id",
                        "дата",
                        "время_начала",
                        "время_окончания",
                        "статус",
                        source,
                        pattern_id,
                        is_override,
                        created_by_user_id,
                        updated_by_user_id
                    ) VALUES ($1, $2, $3, $4, $5, 'manual', NULL, false, $6, $6)
                    ON CONFLICT ("сотрудник_id", "дата")
                    DO UPDATE SET
                        "время_начала" = EXCLUDED."время_начала",
                        "время_окончания" = EXCLUDED."время_окончания",
                        "статус" = EXCLUDED."статус",
                        source = 'manual',
                        pattern_id = "График_работы".pattern_id,
                        is_override = CASE
                            WHEN "График_работы".pattern_id IS NOT NULL THEN true
                            ELSE COALESCE("График_работы".is_override, false)
                        END,
                        updated_by_user_id = EXCLUDED.updated_by_user_id
                    RETURNING
                        id,
                        "дата",
                        "время_начала",
                        "время_окончания",
                        "статус",
                        source,
                        pattern_id,
                        is_override
                `,
                [employeeId, date, startTime, endTime, status, actor.userId]
            );

            res.status(200).json({ ok: true, item: toScheduleItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось сохранить график работы' });
        }
        return;
    }

    if (req.method === 'DELETE') {
        if (!canEdit) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        try {
            const date = String(req.query.date || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                res.status(400).json({ error: 'Некорректная дата графика' });
                return;
            }

            await query(
                'DELETE FROM "График_работы" WHERE "сотрудник_id" = $1 AND "дата" = $2',
                [employeeId, date]
            );

            res.status(200).json({ ok: true, item: null });
        } catch (error) {
            res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось удалить запись графика' });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
}
