import type { NextApiRequest, NextApiResponse } from 'next';
import { hasPermission, requireAuth } from '../../../lib/auth';
import {
    getAutoCalculateShipmentDeliveryCost,
    getDefaultOrderExecutionMode,
    getDefaultVatRateId,
    getUseSupplierAssortment,
    getUseSupplierLeadTime,
    saveAutoCalculateShipmentDeliveryCost,
    saveDefaultOrderExecutionMode,
    saveDefaultVatRateId,
    saveUseSupplierAssortment,
    saveUseSupplierLeadTime,
} from '../../../lib/appSettings';
import { normalizeOrderExecutionMode } from '../../../lib/orderModes';
import { isValidVatRateId, normalizeVatRateId } from '../../../lib/vat';

type SettingsPayload =
    | {
        defaultVatRateId: number;
        defaultOrderExecutionMode: 'warehouse' | 'direct';
        autoCalculateShipmentDeliveryCost: boolean;
        useSupplierAssortment: boolean;
        useSupplierLeadTime: boolean;
      }
    | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SettingsPayload>) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    const canManageCoreSettings = hasPermission(actor, 'admin.settings');
    const canManageSupplierAssortmentSetting = canManageCoreSettings || hasPermission(actor, 'admin.settings.supplier_assortment.manage');
    const canManageSupplierLeadTimeSetting = canManageCoreSettings || hasPermission(actor, 'admin.settings.supplier_lead_time.manage');
    const canViewSettings = canManageCoreSettings || canManageSupplierAssortmentSetting || canManageSupplierLeadTimeSetting;

    if (!canViewSettings) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    if (req.method === 'GET') {
        try {
            const [
                defaultVatRateId,
                defaultOrderExecutionMode,
                autoCalculateShipmentDeliveryCost,
                useSupplierAssortment,
                useSupplierLeadTime,
            ] = await Promise.all([
                getDefaultVatRateId(),
                getDefaultOrderExecutionMode(),
                getAutoCalculateShipmentDeliveryCost(),
                getUseSupplierAssortment(),
                getUseSupplierLeadTime(),
            ]);

            res.status(200).json({
                defaultVatRateId,
                defaultOrderExecutionMode,
                autoCalculateShipmentDeliveryCost,
                useSupplierAssortment,
                useSupplierLeadTime,
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
            const [
                currentDefaultVatRateId,
                currentDefaultOrderExecutionMode,
                currentAutoCalculateShipmentDeliveryCost,
                currentUseSupplierAssortment,
                currentUseSupplierLeadTime,
            ] = await Promise.all([
                getDefaultVatRateId(),
                getDefaultOrderExecutionMode(),
                getAutoCalculateShipmentDeliveryCost(),
                getUseSupplierAssortment(),
                getUseSupplierLeadTime(),
            ]);

            const defaultVatRateId = canManageCoreSettings
                ? normalizeVatRateId(req.body?.defaultVatRateId)
                : currentDefaultVatRateId;
            const defaultOrderExecutionMode = canManageCoreSettings
                ? normalizeOrderExecutionMode(req.body?.defaultOrderExecutionMode)
                : currentDefaultOrderExecutionMode;
            const autoCalculateShipmentDeliveryCost = canManageCoreSettings
                ? Boolean(req.body?.autoCalculateShipmentDeliveryCost)
                : currentAutoCalculateShipmentDeliveryCost;
            const requestedUseSupplierAssortment = Boolean(req.body?.useSupplierAssortment);
            const useSupplierAssortment = canManageSupplierAssortmentSetting
                ? requestedUseSupplierAssortment
                : currentUseSupplierAssortment;
            const requestedUseSupplierLeadTime = Boolean(req.body?.useSupplierLeadTime);
            const useSupplierLeadTime = canManageSupplierLeadTimeSetting
                ? (requestedUseSupplierLeadTime && useSupplierAssortment)
                : (useSupplierAssortment ? currentUseSupplierLeadTime : false);

            if (!isValidVatRateId(defaultVatRateId)) {
                res.status(400).json({ error: 'Некорректная ставка НДС по умолчанию' });
                return;
            }

            await Promise.all([
                saveDefaultVatRateId(defaultVatRateId),
                saveDefaultOrderExecutionMode(defaultOrderExecutionMode),
                saveAutoCalculateShipmentDeliveryCost(autoCalculateShipmentDeliveryCost),
                saveUseSupplierAssortment(useSupplierAssortment),
                saveUseSupplierLeadTime(useSupplierLeadTime),
            ]);

            res.status(200).json({
                defaultVatRateId,
                defaultOrderExecutionMode,
                autoCalculateShipmentDeliveryCost,
                useSupplierAssortment,
                useSupplierLeadTime,
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
