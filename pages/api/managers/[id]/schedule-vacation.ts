import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import { getDbClient } from '../../../../lib/db';

type VacationResponse =
    | { ok: true; affectedDays: number }
    | { error: string };

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

const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<VacationResponse>) {
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
    const canEdit = canManageSchedule || (isOwnSchedule && hasPermission(actor, 'schedule.self.edit'));

    if (!canEdit) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    try {
        const dateFrom = parseDateKey(String(req.body?.dateFrom || '').trim());
        const dateTo = parseDateKey(String(req.body?.dateTo || '').trim());

        if (!dateFrom || !dateTo) {
            res.status(400).json({ error: 'Укажи корректный диапазон отпуска' });
            return;
        }

        if (dateFrom > dateTo) {
            res.status(400).json({ error: 'Дата окончания отпуска должна быть не раньше даты начала' });
            return;
        }

        const client = await getDbClient();

        try {
            await client.query('BEGIN');

            const dateFromKey = formatDateKey(dateFrom);
            const dateToKey = formatDateKey(dateTo);
            const affectedDays = Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1;
            let usedVacationTable = false;

            try {
                await client.query(
                    `
                        INSERT INTO public.employee_vacations (
                            employee_id,
                            date_from,
                            date_to,
                            vacation_type,
                            status,
                            created_by_user_id,
                            updated_by_user_id
                        ) VALUES ($1, $2, $3, 'annual', 'planned', $4, $4)
                    `,
                    [employeeId, dateFromKey, dateToKey, actor.userId]
                );

                await client.query(
                    `
                        DELETE FROM "График_работы"
                        WHERE "сотрудник_id" = $1
                          AND "дата" BETWEEN $2 AND $3
                          AND "статус" = 'отпуск'
                    `,
                    [employeeId, dateFromKey, dateToKey]
                );

                usedVacationTable = true;
            } catch (error: any) {
                if (error?.code !== '42P01') {
                    throw error;
                }
            }

            if (!usedVacationTable) {
                let current = new Date(dateFrom);
                while (current <= dateTo) {
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
                            ) VALUES ($1, $2, NULL, NULL, 'отпуск', 'manual', NULL, false, $3, $3)
                            ON CONFLICT ("сотрудник_id", "дата")
                            DO UPDATE SET
                                "время_начала" = NULL,
                                "время_окончания" = NULL,
                                "статус" = 'отпуск',
                                source = 'manual',
                                pattern_id = "График_работы".pattern_id,
                                is_override = CASE
                                    WHEN "График_работы".pattern_id IS NOT NULL THEN true
                                    ELSE COALESCE("График_работы".is_override, false)
                                END,
                                updated_by_user_id = EXCLUDED.updated_by_user_id
                        `,
                        [employeeId, formatDateKey(current), actor.userId]
                    );

                    current = addDays(current, 1);
                }
            }

            await client.query('COMMIT');
            res.status(200).json({ ok: true, affectedDays });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось оформить отпуск' });
    }
}
