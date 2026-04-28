import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) return;

      const perms = actor.permissions || [];
      const canOrders = perms.includes('archive.orders.list');
      const canPurchases = perms.includes('archive.purchases.list');
      const canShipments = perms.includes('archive.shipments.list');
      const canPayments = perms.includes('archive.payments.list');
      const canFinance = perms.includes('archive.finance.list');
      const canBitrixRequests = perms.includes('archive.bitrix_requests.list');

      const canAnyArchive = canOrders || canPurchases || canShipments || canPayments || canFinance || canBitrixRequests;
      if (!canAnyArchive) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Get completed orders
      const completedOrdersResult = await query(`
        SELECT 
          з.*,
          (
            COALESCE(order_totals.items_total, 0)
            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as общая_сумма,
          к."название" as клиент_название,
          с."фио" as менеджер_фио,
          COUNT(пз.id) as количество_позиций
        FROM "Заявки" з
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        LEFT JOIN "Сотрудники" с ON з."менеджер_id" = с.id
        LEFT JOIN "Позиции_заявки" пз ON з.id = пз."заявка_id"
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
        ) order_totals ON order_totals."заявка_id" = з.id
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
        ) purchase_logistics ON purchase_logistics."заявка_id" = з.id
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
        ) shipment_logistics ON shipment_logistics."заявка_id" = з.id
        WHERE з."статус" IN ('выполнена', 'отменена')
        GROUP BY з.id, к."название", с."фио", order_totals.items_total, purchase_logistics.purchase_delivery_total, shipment_logistics.shipment_delivery_total
        ORDER BY з."дата_выполнения" DESC
        LIMIT 100
      `);

      // Get completed purchases
      const completedPurchasesResult = await query(`
        SELECT 
          зак.*,
          п."название" as поставщик_название,
          COUNT(пз.id) as количество_позиций
        FROM "Закупки" зак
        JOIN "Поставщики" п ON зак."поставщик_id" = п.id
        LEFT JOIN "Позиции_закупки" пз ON зак.id = пз."закупка_id"
        WHERE зак."статус" IN ('получено', 'отменено')
        GROUP BY зак.id, п."название"
        ORDER BY зак."дата_поступления" DESC
        LIMIT 100
      `);

      // Get completed shipments
      const completedShipmentsResult = await query(`
        SELECT 
          о.*,
          з."id" as заявка_номер,
          COALESCE(к."название", 'Самостоятельная отгрузка') as клиент_название,
          COALESCE(
            тк."название",
            CASE
              WHEN COALESCE(о."использовать_доставку", true) THEN 'Транспорт не указан'
              ELSE 'Без доставки'
            END
          ) as транспорт_название
        FROM "Отгрузки" о
        LEFT JOIN "Заявки" з ON о."заявка_id" = з.id
        LEFT JOIN "Клиенты" к ON з."клиент_id" = к.id
        LEFT JOIN "Транспортные_компании" тк ON о."транспорт_id" = тк.id
        WHERE о."статус" IN ('доставлено', 'получено', 'отменено')
        ORDER BY о."дата_отгрузки" DESC
        LIMIT 100
      `);

      // Get employee payments history
      const employeePaymentsResult = await query(`
        SELECT 
          в.*,
          с."фио" as сотрудник_фио,
          с."должность" as сотрудник_должность,
          з."id" as заявка_номер
        FROM "Выплаты" в
        JOIN "Сотрудники" с ON в."сотрудник_id" = с.id
        LEFT JOIN "Заявки" з ON в."заявка_id" = з.id
        ORDER BY в."дата" DESC
        LIMIT 100
      `);

      // Get financial records
      const financialRecordsResult = await query(`
        SELECT 
          фк.*,
          з."id" as заявка_номер,
          зак."id" as закупка_номер,
          о."id" as отгрузка_номер
        FROM "Финансы_компании" фк
        LEFT JOIN "Заявки" з ON фк."заявка_id" = з.id
        LEFT JOIN "Закупки" зак ON фк."закупка_id" = зак.id
        LEFT JOIN "Отгрузки" о ON фк."отгрузка_id" = о.id
        ORDER BY фк."дата" DESC
        LIMIT 100
      `);

      const bitrixRequestsResult = canBitrixRequests
        ? await query(`
          SELECT *
          FROM public.imported_requests
          WHERE processed_at IS NOT NULL
          ORDER BY processed_at DESC, imported_at DESC
          LIMIT 100
        `)
        : { rows: [] as any[] };

      // Get archive statistics
      const statsResult = await query(`
        SELECT 
          (SELECT COUNT(*) FROM "Заявки" WHERE "статус" IN ('выполнена', 'отменена')) as завершенные_заявки,
          (SELECT COUNT(*) FROM "Закупки" WHERE "статус" IN ('получено', 'отменено')) as завершенные_закупки,
          (SELECT COUNT(*) FROM "Отгрузки" WHERE "статус" IN ('доставлено', 'получено', 'отменено')) as завершенные_отгрузки,
          (SELECT COUNT(*) FROM "Выплаты") as всего_выплат,
          (SELECT COUNT(*) FROM "Финансы_компании") as финансовых_записей,
          (SELECT COUNT(*) FROM public.imported_requests WHERE processed_at IS NOT NULL) as заявок_битрикс,
          (
            SELECT SUM(
              COALESCE(order_totals.items_total, 0)
              + COALESCE(purchase_logistics.purchase_delivery_total, 0)
              + COALESCE(shipment_logistics.shipment_delivery_total, 0)
            )
            FROM "Заявки" z
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
            ) order_totals ON order_totals."заявка_id" = z.id
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
            ) purchase_logistics ON purchase_logistics."заявка_id" = z.id
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
            ) shipment_logistics ON shipment_logistics."заявка_id" = z.id
            WHERE z."статус" = 'выполнена'
          ) as выручка_от_заявок,
          (SELECT SUM("общая_сумма") FROM "Закупки" WHERE "статус" = 'получено') as затраты_на_закупки,
          (SELECT SUM("сумма") FROM "Выплаты") as общие_выплаты
      `);

      const stats = statsResult.rows[0] || {};
      if (!canOrders) {
        stats.завершенные_заявки = 0;
        stats.выручка_от_заявок = null;
      }
      if (!canPurchases) {
        stats.завершенные_закупки = 0;
        stats.затраты_на_закупки = null;
      }
      if (!canShipments) {
        stats.завершенные_отгрузки = 0;
      }
      if (!canPayments) {
        stats.всего_выплат = 0;
        stats.общие_выплаты = null;
      }
      if (!canFinance) {
        stats.финансовых_записей = 0;
      }
      if (!canBitrixRequests) {
        stats.заявок_битрикс = 0;
      }

      res.status(200).json({
        completedOrders: canOrders ? completedOrdersResult.rows : [],
        completedPurchases: canPurchases ? completedPurchasesResult.rows : [],
        completedShipments: canShipments ? completedShipmentsResult.rows : [],
        employeePayments: canPayments ? employeePaymentsResult.rows : [],
        financialRecords: canFinance ? financialRecordsResult.rows : [],
        bitrixRequests: canBitrixRequests ? bitrixRequestsResult.rows : [],
        statistics: stats
      });
    } catch (error) {
      console.error('Error fetching archive data:', error);
      res.status(500).json({ error: 'Failed to fetch archive data' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
