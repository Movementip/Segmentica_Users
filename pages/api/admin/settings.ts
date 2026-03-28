import type { NextApiRequest, NextApiResponse } from 'next';
import { requireDirector } from '../../../lib/auth';
import {
    getAutoCalculateShipmentDeliveryCost,
    getDefaultOrderExecutionMode,
    getDefaultVatRateId,
    saveAutoCalculateShipmentDeliveryCost,
    saveDefaultOrderExecutionMode,
    saveDefaultVatRateId,
} from '../../../lib/appSettings';
import { normalizeOrderExecutionMode } from '../../../lib/orderModes';
import { isValidVatRateId, normalizeVatRateId } from '../../../lib/vat';

type SettingsPayload =
    | {
        defaultVatRateId: number;
        defaultOrderExecutionMode: 'warehouse' | 'direct';
        autoCalculateShipmentDeliveryCost: boolean;
      }
    | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SettingsPayload>) {
    const actor = await requireDirector(req, res);
    if (!actor) return;

    if (req.method === 'GET') {
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
                error: error instanceof Error ? error.message : 'Не удалось загрузить системные настройки',
            });
        }
        return;
    }

    if (req.method === 'PUT') {
        try {
            const defaultVatRateId = normalizeVatRateId(req.body?.defaultVatRateId);
            const defaultOrderExecutionMode = normalizeOrderExecutionMode(req.body?.defaultOrderExecutionMode);
            const autoCalculateShipmentDeliveryCost = Boolean(req.body?.autoCalculateShipmentDeliveryCost);

            if (!isValidVatRateId(defaultVatRateId)) {
                res.status(400).json({ error: 'Некорректная ставка НДС по умолчанию' });
                return;
            }

            await Promise.all([
                saveDefaultVatRateId(defaultVatRateId),
                saveDefaultOrderExecutionMode(defaultOrderExecutionMode),
                saveAutoCalculateShipmentDeliveryCost(autoCalculateShipmentDeliveryCost),
            ]);

            res.status(200).json({
                defaultVatRateId,
                defaultOrderExecutionMode,
                autoCalculateShipmentDeliveryCost,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Не удалось сохранить системные настройки',
            });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
}
