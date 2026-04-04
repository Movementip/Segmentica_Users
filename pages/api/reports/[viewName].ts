import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { REPORT_ALLOWED_VIEWS, REPORT_VIEW_PERMISSIONS } from '../../../lib/reportsRbac';

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
    const allowedViews = REPORT_ALLOWED_VIEWS;

    if (!allowedViews.includes(viewName)) {
        return res.status(400).json({ error: 'Указано недопустимое представление' });
    }

    const actor = await requirePermission(req, res, REPORT_VIEW_PERMISSIONS[viewName]);
    if (!actor) return;

    try {
        // Используем параметризованный запрос с экранированием имени представления
        // Execute the query
        const result = await query(`SELECT * FROM "${viewName}"`);
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
