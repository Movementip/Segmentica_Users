import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get all transport companies with their shipments
      const transportResult = await query(`
        SELECT 
          тк.*,
          COALESCE(COUNT(о.id), 0)::integer as общее_количество_отгрузок,
          COALESCE(COUNT(CASE WHEN з."статус" IN ('новая', 'в обработке', 'подтверждена', 'в работе', 'собрана', 'отгружена') THEN 1 END), 0)::integer as активные_отгрузки,
          COALESCE(COUNT(CASE WHEN з."статус" IN ('выполнена', 'отменена') THEN 1 END), 0)::integer as завершенные_отгрузки,
          COALESCE(AVG(о."стоимость_доставки"), 0) as средняя_стоимость,
          COALESCE(SUM(о."стоимость_доставки"), 0) as общая_выручка
        FROM "Транспортные_компании" тк
        LEFT JOIN "Отгрузки" о ON тк.id = о."транспорт_id"
        LEFT JOIN "Заявки" з ON о."заявка_id" = з.id
        GROUP BY тк.id, тк."название", тк."телефон", тк.email, тк."тариф", тк.created_at
        ORDER BY общее_количество_отгрузок DESC, тк."название" ASC
      `);

      // Get recent shipments (last 30 days)
      const recentShipmentsResult = await query(`
        SELECT 
          о.*,
          тк."название" as транспорт_название,
          з."id" as заявка_номер,
          к."название" as клиент_название,
          з."статус" as заявка_статус
        FROM "Отгрузки" о
        JOIN "Транспортные_компании" тк ON о."транспорт_id" = тк.id
        JOIN "Заявки" з ON о."заявка_id" = з.id
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        ORDER BY о."дата_отгрузки" DESC
        LIMIT 50
      `);

      // Get active shipments
      const activeShipmentsResult = await query(`
        SELECT 
          о.*,
          тк."название" as транспорт_название,
          з."id" as заявка_номер,
          к."название" as клиент_название,
          з."статус" as заявка_статус
        FROM "Отгрузки" о
        JOIN "Транспортные_компании" тк ON о."транспорт_id" = тк.id
        JOIN "Заявки" з ON о."заявка_id" = з.id
        JOIN "Клиенты" к ON з."клиент_id" = к.id
        WHERE з."статус" IN ('новая', 'в обработке', 'подтверждена', 'в работе', 'собрана', 'отгружена')
        ORDER BY о."дата_отгрузки" DESC
      `);

      res.status(200).json({
        transport: transportResult.rows,
        recentShipments: recentShipmentsResult.rows,
        activeShipments: activeShipmentsResult.rows
      });
    } catch (error) {
      console.error('Error fetching transport data:', error);
      res.status(500).json({ error: 'Failed to fetch transport data' });
    }
  } else if (req.method === 'POST') {
    // Create new transport company
    try {
      const { название, телефон, email, тариф } = req.body;

      // Validate required fields
      if (!название) {
        return res.status(400).json({ error: 'Название компании обязательно' });
      }

      // Check if company with this name already exists
      const existingCompany = await query(
        'SELECT id FROM "Транспортные_компании" WHERE "название" = $1',
        [название]
      );

      if (existingCompany.rows.length > 0) {
        return res.status(400).json({ error: 'Компания с таким названием уже существует' });
      }

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Некорректный формат email' });
      }

      // Create transport company
      const result = await query(`
        INSERT INTO "Транспортные_компании" (
          "название", "телефон", "email", "тариф", "created_at"
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id, "название"
      `, [название, телефон || null, email || null, тариф || null]);

      res.status(201).json({ 
        message: 'Транспортная компания успешно создана',
        companyId: result.rows[0].id,
        companyName: result.rows[0].название
      });
    } catch (error) {
      console.error('Error creating transport company:', error);
      res.status(500).json({ 
        error: 'Ошибка создания транспортной компании: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'DELETE') {
    // Delete transport company
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID компании обязателен' });
      }

      // Check if company exists
      const companyCheck = await query(
        'SELECT * FROM "Транспортные_компании" WHERE id = $1',
        [id]
      );

      if (companyCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Транспортная компания не найдена' });
      }

      // Check if company has any shipments
      const shipmentsCheck = await query(
        'SELECT COUNT(*) as count FROM "Отгрузки" WHERE "транспорт_id" = $1',
        [id]
      );

      const shipmentsCount = parseInt(shipmentsCheck.rows[0].count);
      if (shipmentsCount > 0) {
        return res.status(400).json({ 
          error: `Нельзя удалить компанию, у которой есть отгрузки (${shipmentsCount} отгр.)` 
        });
      }

      // Delete the company
      await query(
        'DELETE FROM "Транспортные_компании" WHERE id = $1',
        [id]
      );

      res.status(200).json({ message: 'Транспортная компания успешно удалена' });
    } catch (error) {
      console.error('Error deleting transport company:', error);
      res.status(500).json({ 
        error: 'Ошибка удаления транспортной компании: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}