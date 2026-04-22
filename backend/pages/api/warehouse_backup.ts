import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get all warehouse items with product information and stock status
      const warehouseResult = await query(`
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
        ORDER BY с."количество" ASC, т."название" ASC
      `);

      // Get recent warehouse movements (last 30 days)
      const movementsResult = await query(`
        SELECT 
          дс.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          з."id" as заявка_номер,
          зак."id" as закупка_номер
        FROM "Движения_склада" дс
        JOIN "Товары" т ON дс."товар_id" = т.id
        LEFT JOIN "Заявки" з ON дс."заявка_id" = з.id
        LEFT JOIN "Закупки" зак ON дс."закупка_id" = зак.id
        WHERE дс."дата_операции" >= NOW() - INTERVAL '30 days'
        ORDER BY дс."дата_операции" DESC
        LIMIT 50
      `);

      // Get low stock items (quantity <= minimum stock)
      const lowStockResult = await query(`
        SELECT 
          с.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."минимальный_остаток" as товар_мин_остаток
        FROM "Склад" с
        JOIN "Товары" т ON с."товар_id" = т.id
        WHERE с."количество" <= т."минимальный_остаток"
        ORDER BY (с."количество"::float / т."минимальный_остаток"::float) ASC
      `);

      res.status(200).json({
        warehouse: warehouseResult.rows,
        movements: movementsResult.rows,
        lowStock: lowStockResult.rows
      });
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
      res.status(500).json({ error: 'Failed to fetch warehouse data' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}