import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { getTransportCompanyAggregate, getTransportPerformance } from '../../../lib/transportAnalytics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'transport.view');
        if (!actor) return;
        try {
            const canActiveShipmentsView = actor.permissions.includes('transport.active_shipments.view');
            const canHistoryView = actor.permissions.includes('transport.shipments.history.view');
            const canMonthsView = actor.permissions.includes('transport.shipments.months.view');

            // Get transport company details
            const transportResult = await getTransportCompanyAggregate({ query }, String(id));

            if (transportResult.rows.length === 0) {
                return res.status(404).json({ error: 'Transport company not found' });
            }

            const transport = transportResult.rows[0];

            // Get all shipments for this transport company
            const shipmentsResult = canHistoryView
                ? await query(`
        SELECT 
          s.*,
          o."id" as заявка_номер,
          COALESCE(c."название", 'Самостоятельная отгрузка') as клиент_название,
          o."адрес_доставки" as адрес_доставки,
          (
            COALESCE(order_totals.items_total, 0)
            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as сумма_заявки,
          COALESCE(s."статус", o."статус", 'в пути') as заявка_статус
        FROM "Отгрузки" s
        LEFT JOIN "Заявки" o ON s."заявка_id" = o.id
        LEFT JOIN "Клиенты" c ON o."клиент_id" = c.id
        LEFT JOIN (
          SELECT
            positions."заявка_id",
            SUM(
              COALESCE(positions."количество", 0)
              * COALESCE(positions."цена", 0)
              * (1 + COALESCE(vat."ставка", 0) / 100.0)
            )::numeric as items_total
          FROM "Позиции_заявки" positions
          LEFT JOIN "Ставки_НДС" vat ON vat.id = positions."ндс_id"
          GROUP BY positions."заявка_id"
        ) order_totals ON order_totals."заявка_id" = o.id
        LEFT JOIN (
          SELECT
            purchases."заявка_id",
            SUM(
              CASE
                WHEN COALESCE(purchases."использовать_доставку", false)
                  AND COALESCE(purchases."статус", 'заказано') <> 'отменено'
                  THEN COALESCE(purchases."стоимость_доставки", 0)
                ELSE 0
              END
            )::numeric as purchase_delivery_total
          FROM "Закупки" purchases
          GROUP BY purchases."заявка_id"
        ) purchase_logistics ON purchase_logistics."заявка_id" = o.id
        LEFT JOIN (
          SELECT
            shipments."заявка_id",
            SUM(
              CASE
                WHEN COALESCE(shipments."использовать_доставку", true)
                  AND COALESCE(shipments."статус", 'в пути') <> 'отменено'
                  THEN COALESCE(shipments."стоимость_доставки", 0)
                ELSE 0
              END
            )::numeric as shipment_delivery_total
          FROM "Отгрузки" shipments
          GROUP BY shipments."заявка_id"
        ) shipment_logistics ON shipment_logistics."заявка_id" = o.id
        WHERE s."транспорт_id" = $1
        ORDER BY s."дата_отгрузки" DESC, s.id DESC
        LIMIT 100
      `, [id])
                : { rows: [] as any[] };

            // Get performance statistics by month
            const performanceResult = canMonthsView
                ? await getTransportPerformance({ query }, String(id))
                : { rows: [] as any[] };

            // Get current active shipments
            const activeShipmentsResult = canActiveShipmentsView
                ? await query(`
        SELECT 
          s.*,
          o."id" as заявка_номер,
          COALESCE(c."название", 'Самостоятельная отгрузка') as клиент_название,
          o."адрес_доставки" as адрес_доставки,
          COALESCE(s."статус", o."статус", 'в пути') as заявка_статус
        FROM "Отгрузки" s
        LEFT JOIN "Заявки" o ON s."заявка_id" = o.id
        LEFT JOIN "Клиенты" c ON o."клиент_id" = c.id
        WHERE s."транспорт_id" = $1
        AND COALESCE(s."статус", 'в пути') NOT IN ('доставлено', 'получено', 'отменено')
        ORDER BY s."дата_отгрузки" DESC, s.id DESC
      `, [id])
                : { rows: [] as any[] };

            res.status(200).json({
                transport,
                shipments: shipmentsResult.rows,
                performance: performanceResult.rows,
                activeShipments: activeShipmentsResult.rows
            });
        } catch (error) {
            console.error('Error fetching transport details:', error);
            res.status(500).json({ error: 'Failed to fetch transport details' });
        }
    } else if (req.method === 'PUT') {
        // Update transport company information
        const actor = await requirePermission(req, res, 'transport.edit');
        if (!actor) return;
        try {
            const { название, телефон, email, тариф } = req.body;

            // Validate required fields
            if (!название) {
                return res.status(400).json({ error: 'Название компании обязательно' });
            }

            // Check if company exists
            const companyCheck = await query(
                'SELECT id FROM "Транспортные_компании" WHERE id = $1',
                [id]
            );

            if (companyCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Транспортная компания не найдена' });
            }

            // Check if another company with this name already exists (excluding current company)
            const existingCompany = await query(
                'SELECT id FROM "Транспортные_компании" WHERE "название" = $1 AND id != $2',
                [название, id]
            );

            if (existingCompany.rows.length > 0) {
                return res.status(400).json({ error: 'Компания с таким названием уже существует' });
            }

            // Validate email format if provided
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            // Update transport company
            await query(`
        UPDATE "Транспортные_компании" 
        SET "название" = $1, "телефон" = $2, "email" = $3, "тариф" = $4
        WHERE id = $5
      `, [название, телефон || null, email || null, тариф || null, id]);

            res.status(200).json({
                message: 'Информация о транспортной компании успешно обновлена'
            });
        } catch (error) {
            console.error('Error updating transport company:', error);
            res.status(500).json({
                error: 'Ошибка обновления информации о транспортной компании: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
