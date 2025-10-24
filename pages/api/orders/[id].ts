import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export interface OrderDetail {
  id: number;
  клиент_id: number;
  менеджер_id?: number;
  дата_создания: string;
  дата_выполнения?: string;
  статус: string;
  общая_сумма: number;
  адрес_доставки?: string;
  клиент_название?: string;
  клиент_телефон?: string;
  клиент_email?: string;
  клиент_адрес?: string;
  клиент_тип?: string;
  менеджер_фио?: string;
  менеджер_телефон?: string;
  позиции: OrderPosition[];
}

export interface OrderPosition {
  id: number;
  товар_id: number;
  количество: number;
  цена: number;
  сумма: number;
  товар_название: string;
  товар_артикул: string;
  товар_категория?: string;
  товар_единица_измерения: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OrderDetail | { error: string }>
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Получаем основную информацию о заявке
      const orderResult = await query(`
        SELECT 
          z.*,
          k."название" as клиент_название,
          k."телефон" as клиент_телефон,
          k."email" as клиент_email,
          k."адрес" as клиент_адрес,
          k."тип" as клиент_тип,
          s."фио" as менеджер_фио,
          s."телефон" as менеджер_телефон
        FROM "Заявки" z
        LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
        LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
        WHERE z.id = $1
      `, [id]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      const order = orderResult.rows[0];

      // Получаем позиции заявки
      const positionsResult = await query(`
        SELECT 
          пз.*,
          пз."количество" * пз."цена" as сумма,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица_измерения
        FROM "Позиции_заявки" пз
        LEFT JOIN "Товары" т ON пз."товар_id" = т.id
        WHERE пз."заявка_id" = $1
        ORDER BY пз.id
      `, [id]);

      const positions: OrderPosition[] = positionsResult.rows.map((row: any) => ({
        id: row.id,
        товар_id: row.товар_id,
        количество: row.количество,
        цена: parseFloat(row.цена),
        сумма: parseFloat(row.сумма),
        товар_название: row.товар_название,
        товар_артикул: row.товар_артикул,
        товар_категория: row.товар_категория,
        товар_единица_измерения: row.товар_единица_измерения || 'шт'
      }));

      const orderDetail: OrderDetail = {
        id: order.id,
        клиент_id: order.клиент_id,
        менеджер_id: order.менеджер_id,
        дата_создания: order.дата_создания,
        дата_выполнения: order.дата_выполнения,
        статус: order.статус,
        общая_сумма: parseFloat(order.общая_сумма) || 0,
        адрес_доставки: order.адрес_доставки,
        клиент_название: order.клиент_название,
        клиент_телефон: order.клиент_телефон,
        клиент_email: order.клиент_email,
        клиент_адрес: order.клиент_адрес,
        клиент_тип: order.клиент_тип,
        менеджер_фио: order.менеджер_фио,
        менеджер_телефон: order.менеджер_телефон,
        позиции: positions
      };

      res.status(200).json(orderDetail);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ 
        error: 'Ошибка получения детальной информации о заявке: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }
}