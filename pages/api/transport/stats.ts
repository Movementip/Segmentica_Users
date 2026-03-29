import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { companyId } = req.query;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        const companyResult = await query(
            `
            SELECT
              тк.*,
              COALESCE(COUNT(о.id), 0)::integer as общее_количество_отгрузок,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') NOT IN ('доставлено', 'отменено') THEN 1 END), 0)::integer as активные_отгрузки,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') = 'доставлено' THEN 1 END), 0)::integer as завершенные_отгрузки,
              COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
              COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка
            FROM "Транспортные_компании" тк
            LEFT JOIN "Отгрузки" о ON тк.id = о."транспорт_id"
            WHERE тк.id = $1
            GROUP BY тк.id, тк."название", тк."телефон", тк.email, тк."тариф", тк.created_at
            LIMIT 1
          `,
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transport company not found' });
        }

        const performanceResult = await query(
            `
            WITH months AS (
              SELECT generate_series(
                date_trunc('month', now()) - interval '11 months',
                date_trunc('month', now()),
                interval '1 month'
              )::date AS месяц
            ),
            agg AS (
              SELECT
                DATE_TRUNC('month', о."дата_отгрузки")::date as месяц,
                COALESCE(COUNT(о.id), 0)::integer as количество_отгрузок,
                COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') = 'доставлено' THEN 1 END), 0)::integer as успешные_доставки,
                COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
                COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка
              FROM "Отгрузки" о
              WHERE о."транспорт_id" = $1
                AND о."дата_отгрузки" >= (date_trunc('month', now()) - interval '11 months')
                AND о."дата_отгрузки" < (date_trunc('month', now()) + interval '1 month')
              GROUP BY 1
            )
            SELECT
              TO_CHAR(m.месяц, 'YYYY-MM-01') as месяц,
              COALESCE(a.количество_отгрузок, 0)::integer as количество_отгрузок,
              COALESCE(a.успешные_доставки, 0)::integer as успешные_доставки,
              COALESCE(a.средняя_стоимость, 0) as средняя_стоимость,
              COALESCE(a.общая_выручка, 0) as общая_выручка
            FROM months m
            LEFT JOIN agg a ON a.месяц = m.месяц
            ORDER BY m.месяц DESC
          `,
            [companyId]
        );

        const totalsResult = await query(
            `
            SELECT
              COALESCE(COUNT(о.id), 0)::integer as количество_отгрузок,
              COALESCE(COUNT(CASE WHEN COALESCE(о."статус", 'в пути') = 'доставлено' THEN 1 END), 0)::integer as успешные_доставки,
              COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
              COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка
            FROM "Отгрузки" о
            WHERE о."транспорт_id" = $1
              AND о."дата_отгрузки" >= (date_trunc('month', now()) - interval '11 months')
              AND о."дата_отгрузки" < (date_trunc('month', now()) + interval '1 month')
          `,
            [companyId]
        );

        res.status(200).json({
            transport: companyResult.rows[0],
            performance: performanceResult.rows,
            periodTotals: totalsResult.rows[0],
        });
    } catch (error) {
        console.error('Error fetching transport stats:', error);
        res.status(500).json({ error: 'Failed to fetch transport stats' });
    }
}
