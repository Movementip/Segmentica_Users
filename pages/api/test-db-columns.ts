import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get columns for Заявки table
    const orderColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Заявки'
    `);

    // Get columns for Недостающие_товары table
    const missingColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Недостающие_товары'
    `);

    res.status(200).json({ 
      orders: orderColumns.rows,
      missing: missingColumns.rows
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: 'Ошибка подключения к базе данных: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
    });
  }
}