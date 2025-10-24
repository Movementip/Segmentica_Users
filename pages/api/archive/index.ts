import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get completed orders
      const completedOrdersResult = await query(`
        SELECT 
          з.*,
          к."название" as клиент_название,
          с."фио" as менеджер_фио,
          COUNT(пз.id) as количество_позиций
        FROM "Заявки" з
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        LEFT JOIN "Сотрудники" с ON з."менеджер_id" = с.id
        LEFT JOIN "Позиции_заявки" пз ON з.id = пз."заявка_id"
        WHERE з."статус" IN ('выполнена', 'отменена')
        GROUP BY з.id, к."название", с."фио"
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
          к."название" as клиент_название,
          тк."название" as транспорт_название
        FROM "Отгрузки" о
        JOIN "Заявки" з ON о."заявка_id" = з.id
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        JOIN "Транспортные_компании" тк ON о."транспорт_id" = тк.id
        WHERE о."статус" IN ('доставлено', 'отменено')
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

      // Get archive statistics
      const statsResult = await query(`
        SELECT 
          (SELECT COUNT(*) FROM "Заявки" WHERE "статус" IN ('выполнена', 'отменена')) as завершенные_заявки,
          (SELECT COUNT(*) FROM "Закупки" WHERE "статус" IN ('получено', 'отменено')) as завершенные_закупки,
          (SELECT COUNT(*) FROM "Отгрузки" WHERE "статус" IN ('доставлено', 'отменено')) as завершенные_отгрузки,
          (SELECT COUNT(*) FROM "Выплаты") as всего_выплат,
          (SELECT COUNT(*) FROM "Финансы_компании") as финансовых_записей,
          (SELECT SUM("общая_сумма") FROM "Заявки" WHERE "статус" = 'выполнена') as выручка_от_заявок,
          (SELECT SUM("общая_сумма") FROM "Закупки" WHERE "статус" = 'получено') as затраты_на_закупки,
          (SELECT SUM("сумма") FROM "Выплаты") as общие_выплаты
      `);

      res.status(200).json({
        completedOrders: completedOrdersResult.rows,
        completedPurchases: completedPurchasesResult.rows,
        completedShipments: completedShipmentsResult.rows,
        employeePayments: employeePaymentsResult.rows,
        financialRecords: financialRecordsResult.rows,
        statistics: statsResult.rows[0] || {}
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