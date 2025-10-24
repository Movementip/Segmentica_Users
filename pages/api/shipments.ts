import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

interface Shipment {
  id: number;
  заявка_id: number;
  транспорт_id: number;
  статус: string;
  номер_отслеживания: string;
  дата_отгрузки: string;
  стоимость_доставки: number;
  заявка_номер?: string;
  транспорт_название?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Get all shipments with order and transport information
      const result = await query(`
        SELECT 
          о.*,
          тк."название" as транспорт_название
        FROM "Отгрузки" о
        LEFT JOIN "Транспортные_компании" тк ON о."транспорт_id" = тк.id
        ORDER BY о."дата_отгрузки" DESC
      `);

      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      res.status(500).json({ error: 'Failed to fetch shipments: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  } else if (req.method === 'POST') {
    try {
      const { заявка_id, транспорт_id, статус, номер_отслеживания, стоимость_доставки } = req.body;

      // Validate required fields
      if (!заявка_id || !транспорт_id) {
        return res.status(400).json({ 
          error: 'Заявка и транспорт обязательны' 
        });
      }

      // Check if order exists
      const orderCheck = await query(
        'SELECT id FROM "Заявки" WHERE id = $1',
        [заявка_id]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Заявка не найдена' });
      }

      // Check if transport exists
      const transportCheck = await query(
        'SELECT id FROM "Транспортные_компании" WHERE id = $1',
        [транспорт_id]
      );

      if (transportCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Транспортная компания не найдена' });
      }

      // Add shipment
      const result = await query(`
        INSERT INTO "Отгрузки" (
          "заявка_id", "транспорт_id", "статус", "номер_отслеживания", "стоимость_доставки"
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [заявка_id, транспорт_id, статус || 'в пути', номер_отслеживания || null, стоимость_доставки || null]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error adding shipment:', error);
      res.status(500).json({ 
        error: 'Ошибка добавления отгрузки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, статус, номер_отслеживания, стоимость_доставки } = req.body;

      // Validate required fields
      if (!id) {
        return res.status(400).json({ error: 'ID обязателен' });
      }

      // Update shipment
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (статус !== undefined) {
        updateFields.push(`"статус" = $${paramCount}`);
        values.push(статус);
        paramCount++;
      }

      if (номер_отслеживания !== undefined) {
        updateFields.push(`"номер_отслеживания" = $${paramCount}`);
        values.push(номер_отслеживания);
        paramCount++;
      }

      if (стоимость_доставки !== undefined) {
        updateFields.push(`"стоимость_доставки" = $${paramCount}`);
        values.push(стоимость_доставки);
        paramCount++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      values.push(id);

      const result = await query(`
        UPDATE "Отгрузки" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Отгрузка не найдена' });
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating shipment:', error);
      res.status(500).json({ 
        error: 'Ошибка обновления отгрузки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID обязателен' });
      }

      // Delete shipment
      const result = await query(
        'DELETE FROM "Отгрузки" WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Отгрузка не найдена' });
      }

      res.status(200).json({ message: 'Отгрузка успешно удалена' });
    } catch (error) {
      console.error('Error deleting shipment:', error);
      res.status(500).json({ 
        error: 'Ошибка удаления отгрузки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}