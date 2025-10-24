import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

type ErrorResponse = {
  error: string;
  details?: string;
};

type ReportData = Record<string, any>;

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ data?: any[]; } | ErrorResponse>) {
    const { viewName } = req.query;

    if (!viewName || typeof viewName !== 'string') {
        return res.status(400).json({ error: 'Имя представления обязательно' });
    }

    // Список разрешенных представлений для предотвращения SQL-инъекций
    const allowedViews = [
        'анализ_клиентов',
        'анализ_недостач',
        'анализ_поставщиков',
        'движения_склада_детализированные',
        'продажи_по_периодам',
        'статистика_транспортных_компаний',
        'финансовый_обзор',
        'эффективность_сотрудников'
    ];

    if (!allowedViews.includes(viewName)) {
        return res.status(400).json({ error: 'Указано недопустимое представление' });
    }

    try {
        // Используем параметризованный запрос с экранированием имени представления
        // Execute the query
        const result = await query<ReportData[]>(`SELECT * FROM "${viewName}"`);
        res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        res.status(500).json({ 
            error: 'Ошибка при получении данных',
            details: errorMessage
        });
    }
}
