import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if the table exists
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'Отгрузки'
    `);

    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Таблица Отгрузки не найдена в базе данных'
      });
    }

    // Get table structure
    const columns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Отгрузки'
    `);

    // Check if there are any records
    const countResult = await query('SELECT COUNT(*) as count FROM "Отгрузки"');
    const recordCount = parseInt(countResult.rows[0].count);

    res.status(200).json({ 
      message: 'Таблица Отгрузки найдена',
      columns: columns.rows,
      recordCount: recordCount
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: 'Ошибка подключения к базе данных: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
    });
  }
}