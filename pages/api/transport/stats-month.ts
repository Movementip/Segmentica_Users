import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { getTransportMonthShipments, normalizeTransportStatsMonth } from '../../../lib/transportAnalytics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const actor = await requirePermission(req, res, 'transport.stats.view');
    if (!actor) return;

    try {
        const { companyId, month } = req.query;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        if (!month || Array.isArray(month)) {
            return res.status(400).json({ error: 'month is required (YYYY-MM-01)' });
        }

        const normalizedMonth = normalizeTransportStatsMonth(String(month));
        if (!normalizedMonth) {
            return res.status(400).json({ error: 'Некорректный month, ожидается YYYY-MM-01' });
        }
        const shipmentsResult = await getTransportMonthShipments({ query }, companyId, normalizedMonth);

        res.status(200).json({ shipments: shipmentsResult.rows });
    } catch (error) {
        console.error('Error fetching transport month stats:', error);
        res.status(500).json({ error: 'Failed to fetch transport month stats' });
    }
}
