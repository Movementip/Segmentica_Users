import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { getShipmentPositions } from '../../../lib/orderFulfillment';
import { ensureLogisticsDeliverySchema } from '../../../lib/logisticsDelivery';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;
    await ensureLogisticsDeliverySchema();

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const actor = await requirePermission(req, res, 'shipments.view');
    if (!actor) return;

    try {
        const result = await query(
            `
      SELECT 
        o.*,
        z."id" as заявка_номер,
        тк."название" as транспорт_название
      FROM "Отгрузки" o
      LEFT JOIN "Заявки" z ON o."заявка_id" = z.id
      LEFT JOIN "Транспортные_компании" тк ON o."транспорт_id" = тк.id
      WHERE o.id = $1
      LIMIT 1
    `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Отгрузка не найдена' });
        }

        const shipment = result.rows[0];
        const positions = await getShipmentPositions(query, Number(id));

        return res.status(200).json({
            ...shipment,
            позиции: positions,
        });
    } catch (error) {
        console.error('Error fetching shipment detail:', error);
        return res.status(500).json({ error: 'Ошибка получения детальной информации об отгрузке' });
    }
}
