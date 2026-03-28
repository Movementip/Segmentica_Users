import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { companyId, month } = req.query;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        if (!month || Array.isArray(month)) {
            return res.status(400).json({ error: 'month is required (YYYY-MM-01)' });
        }

        // Expecting month as YYYY-MM-01 (first day of month). We will use [month, month+1month)
        const shipmentsResult = await query(
            `
            SELECT
              о.id,
              о."статус",
              о."номер_отслеживания",
              о."дата_отгрузки",
              о."стоимость_доставки",
              з.id as заявка_номер,
              з."статус" as заявка_статус,
              к."название" as клиент_название
            FROM "Отгрузки" о
            JOIN "Заявки" з ON о."заявка_id" = з.id
            JOIN "Клиенты" к ON з."клиент_id" = к.id
            WHERE о."транспорт_id" = $1
              AND о."дата_отгрузки" >= $2::date
              AND о."дата_отгрузки" < ($2::date + interval '1 month')
            ORDER BY о."дата_отгрузки" DESC
          `,
            [companyId, month]
        );

        res.status(200).json({ shipments: shipmentsResult.rows });
    } catch (error) {
        console.error('Error fetching transport month stats:', error);
        res.status(500).json({ error: 'Failed to fetch transport month stats' });
    }
}
