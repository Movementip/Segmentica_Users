import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth, requirePermission } from '../../../lib/auth';

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
            const transportResult = await query(`
        SELECT 
          тк.*,
          COUNT(о.id) as общее_количество_отгрузок,
          COUNT(CASE WHEN COALESCE(о."статус", 'в пути') NOT IN ('доставлено', 'отменено') THEN 1 END) as активные_отгрузки,
          COUNT(CASE WHEN COALESCE(о."статус", 'в пути') = 'доставлено' THEN 1 END) as завершенные_отгрузки,
          COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
          COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка
        FROM "Транспортные_компании" тк
        LEFT JOIN "Отгрузки" о ON тк.id = о."транспорт_id"
        WHERE тк.id = $1
        GROUP BY тк.id, тк."название", тк."телефон", тк.email, тк."тариф", тк.created_at
      `, [id]);

            if (transportResult.rows.length === 0) {
                return res.status(404).json({ error: 'Transport company not found' });
            }

            const transport = transportResult.rows[0];

            // Get all shipments for this transport company
            const shipmentsResult = canHistoryView
                ? await query(`
        SELECT 
          о.*,
          з."id" as заявка_номер,
          COALESCE(к."название", 'Самостоятельная отгрузка') as клиент_название,
          з."адрес_доставки" as адрес_доставки,
          з."общая_сумма" as сумма_заявки,
          COALESCE(о."статус", з."статус", 'в пути') as заявка_статус
        FROM "Отгрузки" о
        LEFT JOIN "Заявки" з ON о."заявка_id" = з.id
        LEFT JOIN "Клиенты" к ON з."клиент_id" = к.id
        WHERE о."транспорт_id" = $1
        ORDER BY о."дата_отгрузки" DESC
        LIMIT 100
      `, [id])
                : { rows: [] as any[] };

            // Get performance statistics by month
            const performanceResult = canMonthsView
                ? await query(`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', о."дата_отгрузки"), 'YYYY-MM-01') as месяц,
          COUNT(*) as количество_отгрузок,
          COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
          COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка,
          COUNT(CASE WHEN о."статус" = 'доставлено' THEN 1 END) as успешные_доставки
        FROM "Отгрузки" о
        WHERE о."транспорт_id" = $1
        GROUP BY DATE_TRUNC('month', о."дата_отгрузки")
        ORDER BY месяц DESC
      `, [id])
                : { rows: [] as any[] };

            // Get current active shipments
            const activeShipmentsResult = canActiveShipmentsView
                ? await query(`
        SELECT 
          о.*,
          з."id" as заявка_номер,
          COALESCE(к."название", 'Самостоятельная отгрузка') as клиент_название,
          з."адрес_доставки" as адрес_доставки,
          COALESCE(о."статус", з."статус", 'в пути') as заявка_статус
        FROM "Отгрузки" о
        LEFT JOIN "Заявки" з ON о."заявка_id" = з.id
        LEFT JOIN "Клиенты" к ON з."клиент_id" = к.id
        WHERE о."транспорт_id" = $1
        AND COALESCE(о."статус", 'в пути') NOT IN ('доставлено', 'отменено')
        ORDER BY о."дата_отгрузки" DESC
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
