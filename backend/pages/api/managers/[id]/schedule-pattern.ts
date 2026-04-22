import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { getDbClient, query } from '../../../../lib/db';

type PatternType = 'five_two' | 'two_two' | 'one_three' | 'custom';

type PatternResponse =
    | { ok: true; patternId: number; affectedDays: number }
    | { error: string };

type CalendarRow = {
    day: string;
    is_workday: boolean;
    is_holiday: boolean;
    is_shortened: boolean;
};

type DayPlan = {
    date: string;
    status: string | null;
    startTime: string | null;
    endTime: string | null;
};

const parseEmployeeId = (value: string | string[] | undefined) => {
    const raw = Array.isArray(value) ? value[0] : value;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const parseDateKey = (value: string) => {
    const [yearRaw, monthRaw, dayRaw] = String(value || '').split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    return new Date(year, month - 1, day);
};

const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeTimeValue = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return /^\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.slice(0, 5) : null;
};

const clampInteger = (value: unknown, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    if (parsed < min || parsed > max) return null;
    return parsed;
};

const createCycleSchema = (patternType: PatternType, workDays: number | null, offDays: number | null) => {
    if (patternType === 'five_two') {
        return ['work', 'work', 'work', 'work', 'work', 'off', 'off'];
    }
    if (patternType === 'two_two') {
        return ['work', 'work', 'off', 'off'];
    }
    if (patternType === 'one_three') {
        return ['work', 'off', 'off', 'off'];
    }
    if (!workDays || !offDays) {
        return null;
    }
    return [...Array.from({ length: workDays }, () => 'work'), ...Array.from({ length: offDays }, () => 'off')];
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<PatternResponse>) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    const employeeId = parseEmployeeId(req.query.id);
    if (!employeeId) {
        res.status(400).json({ error: 'Некорректный ID сотрудника' });
        return;
    }

    const isOwnSchedule = actor.employee.id === employeeId;
    const canManageSchedule = hasPermission(actor, 'schedule.manage') || hasPermission(actor, 'managers.edit');
    const canApplyPattern = canManageSchedule || (isOwnSchedule && hasPermission(actor, 'schedule.self.apply_pattern'));

    if (!canApplyPattern) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    try {
        const patternType = String(req.body?.patternType || '').trim() as PatternType;
        const month = String(req.body?.month || '').trim();
        const anchorDateRaw = String(req.body?.anchorDate || '').trim();
        const shiftStart = normalizeTimeValue(req.body?.shiftStart);
        const shiftEnd = normalizeTimeValue(req.body?.shiftEnd);
        const customWorkDays = clampInteger(req.body?.customWorkDays, 1, 31);
        const customOffDays = clampInteger(req.body?.customOffDays, 1, 31);

        if (!['five_two', 'two_two', 'one_three', 'custom'].includes(patternType)) {
            res.status(400).json({ error: 'Некорректный тип шаблона' });
            return;
        }

        if (!/^\d{4}-\d{2}$/.test(month)) {
            res.status(400).json({ error: 'Некорректный месяц применения шаблона' });
            return;
        }

        const anchorDate = parseDateKey(anchorDateRaw);
        if (!anchorDate) {
            res.status(400).json({ error: 'Некорректная дата старта цикла' });
            return;
        }

        if (shiftStart && shiftEnd && shiftEnd <= shiftStart) {
            res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
            return;
        }

        const cycleSchema = createCycleSchema(patternType, customWorkDays, customOffDays);
        if (!cycleSchema || cycleSchema.length === 0) {
            res.status(400).json({ error: 'Не удалось построить цикл шаблона' });
            return;
        }

        const respectProductionCalendar = patternType === 'five_two'
            ? Boolean(req.body?.respectProductionCalendar ?? true)
            : Boolean(req.body?.respectProductionCalendar ?? false);
        const shortenPreholiday = patternType === 'five_two'
            ? Boolean(req.body?.shortenPreholiday ?? true)
            : false;

        const [yearRaw, monthRaw] = month.split('-');
        const year = Number(yearRaw);
        const monthNumber = Number(monthRaw);
        const rangeStart = new Date(year, monthNumber - 1, 1);
        const rangeEnd = new Date(year, 11, 31);

        const calendarResult = await query(
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
            [formatDateKey(rangeStart), formatDateKey(rangeEnd)]
        );

        const calendarMap = buildCalendarMap(calendarResult.rows as CalendarRow[]);
        const days: DayPlan[] = [];
        let current = new Date(rangeStart);

        while (current <= rangeEnd) {
            const dateKey = formatDateKey(current);
            const offset = diffInDays(current, anchorDate);
            const cycleIndex = ((offset % cycleSchema.length) + cycleSchema.length) % cycleSchema.length;
            const cycleValue = cycleSchema[cycleIndex];
            const calendarInfo = calendarMap.get(dateKey);
            const weekendFallback = ((current.getDay() + 6) % 7) >= 5;
            const isCalendarWorkday = calendarInfo ? calendarInfo.is_workday : !weekendFallback;
            const isShortened = calendarInfo ? calendarInfo.is_shortened : false;

            let status: string | null = null;
            let startTime: string | null = null;
            let endTime: string | null = null;

            if (cycleValue === 'work') {
                if (!respectProductionCalendar || isCalendarWorkday) {
                    status = 'Работал';
                    startTime = shiftStart;
                    endTime = shortenPreholiday && isShortened ? subtractHour(shiftEnd) : shiftEnd;
                }
            }

            days.push({
                date: dateKey,
                status,
                startTime,
                endTime,
            });
            current = addDays(current, 1);
        }

        const client = await getDbClient();

        try {
            await client.query('BEGIN');

            const patternName = patternType === 'five_two'
                ? 'Шаблон 5/2'
                : patternType === 'two_two'
                    ? 'Шаблон 2/2'
                    : patternType === 'one_three'
                        ? 'Шаблон 1/3'
                        : `Шаблон ${customWorkDays}/${customOffDays}`;

            await client.query(
                `
                    UPDATE public.employee_schedule_patterns
                    SET
                        is_active = false,
                        updated_by_user_id = $4,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE employee_id = $1
                      AND is_active = true
                      AND date_from <= $3
                      AND COALESCE(date_to, DATE '9999-12-31') >= $2
                `,
                [employeeId, formatDateKey(rangeStart), formatDateKey(rangeEnd), actor.userId]
            );

            const patternResult = await client.query(
                `
                    INSERT INTO public.employee_schedule_patterns (
                        employee_id,
                        name,
                        pattern_type,
                        cycle_schema,
                        anchor_date,
                        date_from,
                        date_to,
                        shift_start,
                        shift_end,
                        respect_production_calendar,
                        shorten_preholiday,
                        is_active,
                        created_by_user_id,
                        updated_by_user_id
                    ) VALUES (
                        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, true, $12, $12
                    )
                    RETURNING id
                `,
                [
                    employeeId,
                    patternName,
                    patternType,
                    JSON.stringify(cycleSchema),
                    formatDateKey(anchorDate),
                    formatDateKey(rangeStart),
                    formatDateKey(rangeEnd),
                    shiftStart,
                    shiftEnd,
                    respectProductionCalendar,
                    shortenPreholiday,
                    actor.userId,
                ]
            );

            const patternId = Number(patternResult.rows[0]?.id);
            const persistedDays = days.filter((day) => day.status);

            await client.query(
                `
                    DELETE FROM "График_работы"
                    WHERE "сотрудник_id" = $1
                      AND "дата" BETWEEN $2 AND $3
                      AND NOT COALESCE(is_override, false)
                `,
                [employeeId, formatDateKey(rangeStart), formatDateKey(rangeEnd)]
            );

            for (const day of persistedDays) {
                await client.query(
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
                        ) VALUES ($1, $2, $3, $4, $5, 'pattern', $6, false, $7, $7)
                        ON CONFLICT ("сотрудник_id", "дата")
                        DO UPDATE SET
                            "время_начала" = EXCLUDED."время_начала",
                            "время_окончания" = EXCLUDED."время_окончания",
                            "статус" = EXCLUDED."статус",
                            source = 'pattern',
                            pattern_id = EXCLUDED.pattern_id,
                            is_override = false,
                            updated_by_user_id = EXCLUDED.updated_by_user_id
                        WHERE NOT COALESCE("График_работы".is_override, false)
                    `,
                    [employeeId, day.date, day.startTime, day.endTime, day.status, patternId, actor.userId]
                );
            }

            await client.query('COMMIT');
            res.status(200).json({ ok: true, patternId, affectedDays: persistedDays.length });
        } catch (transactionError) {
            await client.query('ROLLBACK');
            throw transactionError;
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось применить шаблон графика' });
    }
}
