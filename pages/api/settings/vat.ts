import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { getDefaultVatRateId } from '../../../lib/appSettings';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ defaultVatRateId: number } | { error: string }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    try {
        const defaultVatRateId = await getDefaultVatRateId();
        res.status(200).json({ defaultVatRateId });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось загрузить настройки НДС'
        });
    }
}
