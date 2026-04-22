import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '../../../lib/auth';
import { getAutoCalculateShipmentDeliveryCost, getDefaultOrderExecutionMode, getDefaultVatRateId } from '../../../lib/appSettings';

type Payload =
    | { defaultVatRateId: number; defaultOrderExecutionMode: 'warehouse' | 'direct'; autoCalculateShipmentDeliveryCost: boolean }
    | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Payload>) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    try {
        const [defaultVatRateId, defaultOrderExecutionMode, autoCalculateShipmentDeliveryCost] = await Promise.all([
            getDefaultVatRateId(),
            getDefaultOrderExecutionMode(),
            getAutoCalculateShipmentDeliveryCost(),
        ]);

        res.status(200).json({
            defaultVatRateId,
            defaultOrderExecutionMode,
            autoCalculateShipmentDeliveryCost,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось загрузить системные настройки заявки',
        });
    }
}
