import type { NextApiRequest, NextApiResponse } from 'next';
import { requirePermission } from '../../../../lib/auth';
import { getRemainingShipmentDraft } from '../../../../lib/orderFulfillment';
import { query } from '../../../../lib/db';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../../../lib/vat';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const actor = await requirePermission(req, res, 'orders.view');
    if (!actor) return;

    const { id } = req.query;
    const orderId = Number(Array.isArray(id) ? id[0] : id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID заявки' });
    }

    try {
        const positions = await getRemainingShipmentDraft(query, orderId);
        const payload = positions.map((position, index) => {
            const vatOption = getVatRateOption(position.ндс_id);
            const amounts = calculateVatAmountsFromLine(
                Number(position.количество) || 0,
                Number(position.цена) || 0,
                vatOption.rate
            );

            return {
                id: index + 1,
                товар_id: position.товар_id,
                количество: position.количество,
                цена: position.цена,
                ндс_id: position.ндс_id,
                ндс_название: vatOption.label,
                ндс_ставка: vatOption.rate,
                сумма_без_ндс: amounts.net,
                сумма_ндс: amounts.tax,
                сумма_всего: amounts.total,
                товар_название: position.товар_название,
                товар_артикул: position.товар_артикул,
                товар_единица_измерения: position.товар_единица_измерения,
            };
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('Error fetching shipment draft:', error);
        return res.status(500).json({ error: 'Не удалось загрузить черновик отгрузки' });
    }
}
