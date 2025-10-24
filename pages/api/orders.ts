import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { checkAndCreateMissingProducts } from '../../lib/missingProductsHelper';

export interface Order {
  id: number;
  клиент_id: number;
  менеджер_id?: number;
  дата_создания: string;
  дата_выполнения?: string;
  статус: string;
  общая_сумма: number;
  адрес_доставки?: string;
  // Дополнительная информация о клиенте
  клиент_название?: string;
  менеджер_фио?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Order[] | Order | { error: string } | { message: string; deletedOrder?: Order }>
) {
  if (req.method === 'GET') {
    try {
      const { client_id } = req.query;
      
      // Если передан client_id, фильтруем по клиенту
      if (client_id) {
        const result = await query(`
          SELECT 
            z.*,
            k."название" as клиент_название,
            s."фио" as менеджер_фио
          FROM "Заявки" z
          LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
          LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
          WHERE z."клиент_id" = $1
          ORDER BY z."дата_создания" DESC
        `, [client_id]);
        
        const orders: Order[] = result.rows.map((row: any) => ({
          id: row.id,
          клиент_id: row.клиент_id,
          менеджер_id: row.менеджер_id,
          дата_создания: row.дата_создания,
          дата_выполнения: row.дата_выполнения,
          статус: row.статус,
          общая_сумма: parseFloat(row.общая_сумма) || 0,
          адрес_доставки: row.адрес_доставки,
          клиент_название: row.клиент_название,
          менеджер_фио: row.менеджер_фио
        }));
        
        res.status(200).json(orders);
        return;
      }
      
      // Подключение к реальной базе данных с JOIN для получения информации о клиентах
      const result = await query(`
        SELECT 
          z.*,
          k."название" as клиент_название,
          s."фио" as менеджер_фио
        FROM "Заявки" z
        LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
        LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
        ORDER BY z."дата_создания" DESC 
        LIMIT 50
      `);
      
      const orders: Order[] = result.rows.map((row: any) => ({
        id: row.id,
        клиент_id: row.клиент_id,
        менеджер_id: row.менеджер_id,
        дата_создания: row.дата_создания,
        дата_выполнения: row.дата_выполнения,
        статус: row.статус,
        общая_сумма: parseFloat(row.общая_сумма) || 0,
        адрес_доставки: row.адрес_доставки,
        клиент_название: row.клиент_название,
        менеджер_фио: row.менеджер_фио
      }));
      
      res.status(200).json(orders);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ 
        error: 'Ошибка получения заявок из базы данных: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  } else if (req.method === 'POST') {
    try {
      const {
        клиент_id,
        менеджер_id,
        адрес_доставки,
        позиции
      } = req.body;

      // Validate required fields
      if (!клиент_id || !позиции || позиции.length === 0) {
        return res.status(400).json({ error: 'Клиент и позиции заявки обязательны' });
      }

      // Calculate total amount
      const общая_сумма = позиции.reduce((sum: number, item: any) => 
        sum + (item.количество * item.цена), 0
      );

      // Create order
      const orderResult = await query(`
        INSERT INTO "Заявки" (
          "клиент_id", 
          "менеджер_id", 
          "адрес_доставки", 
          "общая_сумма", 
          "статус"
        ) VALUES ($1, $2, $3, $4, 'новая')
        RETURNING *
      `, [клиент_id, менеджер_id || null, адрес_доставки || null, общая_сумма]);

      const newOrder = orderResult.rows[0];

      // Add order positions
      for (const позиция of позиции) {
        await query(`
          INSERT INTO "Позиции_заявки" (
            "заявка_id", 
            "товар_id", 
            "количество", 
            "цена"
          ) VALUES ($1, $2, $3, $4)
        `, [newOrder.id, позиция.товар_id, позиция.количество, позиция.цена]);
      }

      // Check for missing products and create records if needed
      await checkAndCreateMissingProducts(newOrder.id);

      res.status(201).json(newOrder);
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  } else if (req.method === 'PUT') {
    try {
      const {
        id,
        клиент_id,
        менеджер_id,
        адрес_доставки,
        статус,
        позиции
      } = req.body;

      console.log('Updating order with data:', {
        id,
        клиент_id,
        менеджер_id,
        адрес_доставки,
        статус,
        позиции
      }); // Debug log

      // Validate required fields
      if (!id || !клиент_id) {
        return res.status(400).json({ error: 'ID заявки и клиент обязательны' });
      }

      // Calculate total amount if positions are provided
      let общая_сумма;
      if (позиции && позиции.length > 0) {
        общая_сумма = позиции.reduce((sum: number, item: any) => 
          sum + (item.количество * item.цена), 0
        );
      }

      // Update order
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      updateFields.push(`"клиент_id" = $${paramCount}`);
      values.push(клиент_id);
      paramCount++;

      if (менеджер_id !== undefined) {
        updateFields.push(`"менеджер_id" = $${paramCount}`);
        values.push(менеджер_id);
        paramCount++;
      }

      if (адрес_доставки !== undefined) {
        updateFields.push(`"адрес_доставки" = $${paramCount}`);
        values.push(адрес_доставки);
        paramCount++;
      }

      if (статус !== undefined) {
        updateFields.push(`"статус" = $${paramCount}`);
        values.push(статус);
        paramCount++;
      }

      if (общая_сумма !== undefined) {
        updateFields.push(`"общая_сумма" = $${paramCount}`);
        values.push(общая_сумма);
        paramCount++;
      }

      values.push(id);

      console.log('Executing update query:', `UPDATE "Заявки" SET ${updateFields.join(', ')} WHERE id = $${paramCount}`);
      console.log('Query values:', values);

      const orderResult = await query(`
        UPDATE "Заявки" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      console.log('Update result:', orderResult.rows);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      // Update positions if provided
      if (позиции) {
        // Delete existing positions
        await query('DELETE FROM "Позиции_заявки" WHERE "заявка_id" = $1', [id]);
        
        // Add new positions
        for (const позиция of позиции) {
          await query(`
            INSERT INTO "Позиции_заявки" (
              "заявка_id", 
              "товар_id", 
              "количество", 
              "цена"
            ) VALUES ($1, $2, $3, $4)
          `, [id, позиция.товар_id, позиция.количество, позиция.цена]);
        }
      }

      // Check for missing products and create/update records if needed
      await checkAndCreateMissingProducts(id);

      res.status(200).json(orderResult.rows[0]);
    } catch (error) {
      console.error('Error updating order:', error);
      
      // Check if it's a database constraint error
      if (error instanceof Error) {
        if (error.message.includes('constraint') || error.message.includes('Нарушение')) {
          return res.status(400).json({ 
            error: 'Нарушение ограничений базы данных: ' + error.message 
          });
        }
        
        return res.status(500).json({ 
          error: 'Database error: ' + error.message 
        });
      }
      
      res.status(500).json({ error: 'Failed to update order' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID заявки обязателен' });
      }

      // Delete order positions first (foreign key constraint)
      await query('DELETE FROM "Позиции_заявки" WHERE "заявка_id" = $1', [id]);
      
      // Delete order
      const result = await query('DELETE FROM "Заявки" WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      res.status(200).json({ message: 'Заявка успешно удалена', deletedOrder: result.rows[0] });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }
}