import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { getTransportCompanyAggregate, getTransportPerformance, getTransportPeriodTotals } from '../../../lib/transportAnalytics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const actor = await requirePermission(req, res, 'transport.stats.view');
    if (!actor) return;

    try {
        const { companyId } = req.query;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        const companyResult = await getTransportCompanyAggregate({ query }, companyId);

        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transport company not found' });
        }

        const performanceResult = await getTransportPerformance({ query }, companyId);
        const totalsResult = await getTransportPeriodTotals({ query }, companyId);

        res.status(200).json({
            transport: companyResult.rows[0],
            performance: performanceResult.rows,
            periodTotals: totalsResult.rows[0],
        });
    } catch (error) {
        console.error('Error fetching transport stats:', error);
        res.status(500).json({ error: 'Failed to fetch transport stats' });
    }
}
