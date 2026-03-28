import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'warehouse.view');
        if (!actor) return;
        try {
            // Get warehouse item details with product information and stock status
            const itemResult = await query(`
        SELECT 
          с.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица,
          т."минимальный_остаток" as товар_мин_остаток,
          т."цена_закупки" as товар_цена_закупки,
          т."цена_продажи" as товар_цена_продажи,
          CASE 
            WHEN с."количество" <= т."минимальный_остаток" THEN 'critical'
            WHEN с."количество" <= т."минимальный_остаток" * 2 THEN 'low' 
            ELSE 'normal'
          END as stock_status
        FROM "Склад" с
        JOIN "Товары" т ON с."товар_id" = т.id
        WHERE с.id = $1
      `, [id]);

            if (itemResult.rows.length === 0) {
                return res.status(404).json({ error: 'Warehouse item not found' });
            }

            const item = itemResult.rows[0];

            // Get all movements for this item (RBAC: warehouse.movements.view)
            const movementsResult = actor.permissions?.includes('warehouse.movements.view')
                ? await query(`
        SELECT 
          дс.*,
          з."id" as заявка_номер,
          к."название" as клиент_название,
          зак."id" as закупка_номер,
          п."название" as поставщик_название
        FROM "Движения_склада" дс
        LEFT JOIN "Заявки" з ON дс."заявка_id" = з.id
        LEFT JOIN "Клиенты" к ON з."клиент_id" = к.id
        LEFT JOIN "Закупки" зак ON дс."закупка_id" = зак.id
        LEFT JOIN "Поставщики" п ON зак."поставщик_id" = п.id
        WHERE дс."товар_id" = $1
        ORDER BY дс."дата_операции" DESC
        LIMIT 100
      `, [item.товар_id])
                : { rows: [] as any[] };

            // Get current orders waiting for this item (RBAC: warehouse.waiting_orders.view)
            const waitingOrdersResult = actor.permissions?.includes('warehouse.waiting_orders.view')
                ? await query(`
        SELECT 
          пз.*,
          з."id" as заявка_номер,
          з."статус" as заявка_статус,
          к."название" as клиент_название,
          з."дата_создания" as заявка_дата
        FROM "Позиции_заявки" пз
        JOIN "Заявки" з ON пз."заявка_id" = з.id
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        WHERE пз."товар_id" = $1 
        AND з."статус" IN ('новая', 'в обработке', 'частично выполнена')
        ORDER BY з."дата_создания" ASC
      `, [item.товар_id])
                : { rows: [] as any[] };

            // Get pending purchases for this item (RBAC: warehouse.pending_purchases.view)
            const pendingPurchasesResult = actor.permissions?.includes('warehouse.pending_purchases.view')
                ? await query(`
        SELECT 
          пз.*,
          зак."id" as закупка_номер,
          зак."статус" as закупка_статус,
          п."название" as поставщик_название,
          зак."дата_заказа" as закупка_дата,
          зак."дата_поступления" as ожидаемая_дата
        FROM "Позиции_закупки" пз
        JOIN "Закупки" зак ON пз."закупка_id" = зак.id
        JOIN "Поставщики" п ON зак."поставщик_id" = п.id
        WHERE пз."товар_id" = $1 
        AND зак."статус" IN ('заказано', 'в пути')
        ORDER BY зак."дата_заказа" DESC
      `, [item.товар_id])
                : { rows: [] as any[] };

            res.status(200).json({
                item,
                movements: movementsResult.rows,
                waitingOrders: waitingOrdersResult.rows,
                pendingPurchases: pendingPurchasesResult.rows
            });
        } catch (error) {
            console.error('Error fetching warehouse item details:', error);
            res.status(500).json({ error: 'Failed to fetch warehouse item details' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}