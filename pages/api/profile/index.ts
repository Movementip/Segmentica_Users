import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

type ProfileResponse = {
    profile: {
        id: number;
        userId: number;
        fio: string;
        position: string | null;
        phone: string | null;
        email: string | null;
        rate: number | null;
        hireDate: string | null;
        isActive: boolean;
        createdAt: string | null;
    };
    roles: string[];
    permissions: Array<{
        key: string;
        name: string | null;
        description: string | null;
    }>;
    payroll: {
        available: boolean;
        monthsRequested: number;
        totalPaid: number;
        paymentCount: number;
        latestPaymentDate: string | null;
        items: Array<{
            id: string;
            date: string;
            amount: number;
            type: string | null;
            status: string | null;
            relatedOrderId: number | null;
        }>;
    };
};

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

async function getPayroll(employeeId: number, monthsRequested: number): Promise<ProfileResponse['payroll']> {
    const paymentsTableName = 'Выплаты';
    const exists = await hasTable(paymentsTableName);
    if (!exists) {
        return {
            available: false,
            monthsRequested,
            totalPaid: 0,
            paymentCount: 0,
            latestPaymentDate: null,
            items: [],
        };
    }

    const cols = await getTableColumns(paymentsTableName);
    const idCol = pickCol(cols, ['id']);
    const employeeCol = pickCol(cols, ['сотрудник_id', 'employee_id', 'manager_id', 'менеджер_id']);
    const amountCol = pickCol(cols, ['сумма', 'amount', 'payment_amount', 'total_amount']);
    const dateCol = pickCol(cols, ['дата', 'payment_date', 'paid_at', 'created_at']);
    const typeCol = pickCol(cols, ['тип', 'type', 'назначение', 'комментарий', 'comment']);
    const statusCol = pickCol(cols, ['статус', 'status']);
    const orderCol = pickCol(cols, ['заявка_id', 'order_id']);

    if (!idCol || !employeeCol || !amountCol || !dateCol) {
        return {
            available: false,
            monthsRequested,
            totalPaid: 0,
            paymentCount: 0,
            latestPaymentDate: null,
            items: [],
        };
    }

    const selectFields = [
        `${quoteIdent(idCol)}::text AS id`,
        `${quoteIdent(dateCol)} AS payment_date`,
        `COALESCE(${quoteIdent(amountCol)}, 0)::numeric AS amount`,
        `${typeCol ? `${quoteIdent(typeCol)}::text` : 'NULL::text'} AS payment_type`,
        `${statusCol ? `${quoteIdent(statusCol)}::text` : 'NULL::text'} AS payment_status`,
        `${orderCol ? `${quoteIdent(orderCol)}::int` : 'NULL::int'} AS related_order_id`,
    ];

    const paymentsRes = await query(
        `
        SELECT ${selectFields.join(', ')}
        FROM public.${quoteIdent(paymentsTableName)}
        WHERE ${quoteIdent(employeeCol)} = $1
          AND ${quoteIdent(dateCol)} IS NOT NULL
          AND ${quoteIdent(dateCol)} >= (date_trunc('month', CURRENT_DATE) - ($2::int - 1) * interval '1 month')
        ORDER BY ${quoteIdent(dateCol)} DESC, ${quoteIdent(idCol)} DESC
        LIMIT 500
        `,
        [employeeId, monthsRequested]
    );

    const items = (paymentsRes.rows || []).map((row: any) => ({
        id: String(row.id),
        date: row.payment_date instanceof Date ? row.payment_date.toISOString() : String(row.payment_date),
        amount: Number(row.amount) || 0,
        type: row.payment_type == null ? null : String(row.payment_type),
        status: row.payment_status == null ? null : String(row.payment_status),
        relatedOrderId: row.related_order_id == null ? null : Number(row.related_order_id),
    }));

    return {
        available: true,
        monthsRequested,
        totalPaid: items.reduce((sum, item) => sum + item.amount, 0),
        paymentCount: items.length,
        latestPaymentDate: items[0]?.date || null,
        items,
    };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ProfileResponse | { error: string }>) {
    try {
        const actor = await requireAuth(req, res);
        if (!actor) return;

        if (req.method === 'GET') {
            const monthsRaw = Array.isArray(req.query.months) ? req.query.months[0] : req.query.months;
            const monthsParsed = Number(monthsRaw);
            const monthsRequested = [1, 3, 6, 12, 24].includes(monthsParsed) ? monthsParsed : 6;

            const profileRes = await query(
                `
                SELECT
                    id,
                    "фио" AS fio,
                    "должность" AS position,
                    "телефон" AS phone,
                    "email" AS email,
                    "ставка" AS rate,
                    "дата_приема" AS hire_date,
                    "активен" AS is_active,
                    created_at
                FROM public."Сотрудники"
                WHERE id = $1
                LIMIT 1
                `,
                [actor.employee.id]
            );

            const row = profileRes.rows?.[0];
            if (!row) {
                return res.status(404).json({ error: 'Профиль сотрудника не найден' });
            }

            const permissionsRes = await query(
                `
                SELECT key, name, description
                FROM public.permissions
                WHERE key = ANY($1::text[])
                ORDER BY key ASC
                `,
                [actor.permissions || []]
            );

            const payroll = await getPayroll(actor.employee.id, monthsRequested);

            return res.status(200).json({
                profile: {
                    id: Number(row.id),
                    userId: actor.userId,
                    fio: String(row.fio || ''),
                    position: row.position == null ? null : String(row.position),
                    phone: row.phone == null ? null : String(row.phone),
                    email: row.email == null ? null : String(row.email),
                    rate: row.rate == null ? null : Number(row.rate),
                    hireDate: row.hire_date == null ? null : String(row.hire_date),
                    isActive: Boolean(row.is_active),
                    createdAt: row.created_at == null ? null : String(row.created_at),
                },
                roles: actor.roles || [],
                permissions: (permissionsRes.rows || []).map((permission: any) => ({
                    key: String(permission.key),
                    name: permission.name == null ? null : String(permission.name),
                    description: permission.description == null ? null : String(permission.description),
                })),
                payroll,
            });
        }

        if (req.method === 'PUT') {
            const body = req.body || {};
            const fio = typeof body.fio === 'string' ? body.fio.trim() : undefined;
            const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
            const email = typeof body.email === 'string' ? body.email.trim() : undefined;

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            const sets: string[] = [];
            const values: any[] = [];

            if (fio !== undefined) {
                sets.push(`"фио" = $${values.length + 1}`);
                values.push(fio || null);
            }

            if (phone !== undefined) {
                sets.push(`"телефон" = $${values.length + 1}`);
                values.push(phone || null);
            }

            if (email !== undefined) {
                sets.push(`"email" = $${values.length + 1}`);
                values.push(email || null);
            }

            if (sets.length === 0) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            values.push(actor.employee.id);

            await query(
                `
                UPDATE public."Сотрудники"
                SET ${sets.join(', ')}
                WHERE id = $${values.length}
                `,
                values
            );

            const redirectReq = { ...req, method: 'GET', query: { ...req.query } } as NextApiRequest;
            return handler(redirectReq, res);
        }

        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    } catch (error) {
        console.error('Profile API error:', error);
        return res.status(500).json({ error: 'Ошибка профиля' });
    }
}
