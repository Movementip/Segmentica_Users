import type { NextApiRequest, NextApiResponse } from 'next';
import { requirePermission } from '../../../../lib/auth';
import { getOrderWorkflowSummary, getWorkflowDisplayStatus } from '../../../../lib/orderWorkflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const actor = await requirePermission(req, res, 'orders.view');
    if (!actor) return;

    const { id } = req.query;
    const orderId = Number(id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID заявки' });
    }

    try {
        const summary = await getOrderWorkflowSummary(orderId);
        return res.status(200).json({
            ...summary,
            currentStatus: getWorkflowDisplayStatus(summary),
        });
    } catch (error) {
        console.error('Error fetching order workflow summary:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Ошибка получения сводки по заявке'
        });
    }
}
