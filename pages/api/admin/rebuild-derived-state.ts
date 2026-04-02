import type { NextApiRequest, NextApiResponse } from 'next';
import { requirePermission } from '../../../lib/auth';
import { rebuildDerivedState } from '../../../lib/rebuildDerivedState';

type ResponsePayload =
    | {
        message: string;
        ordersProcessed: number;
        purchasesProcessed: number;
        shipmentsProcessed: number;
        standaloneShipmentsProcessed: number;
        linkedShipmentFinanceDeleted: number;
    }
    | { error: string };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponsePayload>
) {
    const actor = await requirePermission(req, res, 'admin.settings');
    if (!actor) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    try {
        const snapshot = await rebuildDerivedState();

        return res.status(200).json({
            message: 'Производные данные пересобраны',
            ordersProcessed: snapshot.orderIds.length,
            purchasesProcessed: snapshot.purchaseIds.length,
            shipmentsProcessed: snapshot.shipmentIds.length,
            standaloneShipmentsProcessed: snapshot.standaloneShipmentIds.length,
            linkedShipmentFinanceDeleted: snapshot.linkedShipmentFinanceDeleted,
        });
    } catch (error) {
        console.error('rebuild derived state error', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось пересобрать производные данные',
        });
    }
}
