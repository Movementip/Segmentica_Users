import type { NextApiRequest, NextApiResponse } from 'next';
import { requirePermission } from '../../../lib/auth';
import {
    getSupplierAssortmentCatalog,
    getSupplierAssortmentMapForSupplier,
    getSupplierAssortmentSettings,
    getSupplierRecommendationsForPositions,
    normalizeSupplierAssortmentPositions,
} from '../../../lib/supplierAssortment';

type ResponsePayload =
    | {
        settings: {
            useSupplierAssortment: boolean;
            useSupplierLeadTime: boolean;
        };
        recommendations: Array<{
            supplierId: number;
            supplierName: string;
            matchedCount: number;
            totalRequested: number;
            fullyMatches: boolean;
            missingProductIds: number[];
            totalPrice: number | null;
            maxLeadTimeDays: number | null;
            positions: Array<{
                товар_id: number;
                цена: number;
                срок_поставки: number;
            }>;
        }>;
        selectedSupplierAssortment: Record<string, { цена: number; срок_поставки: number }>;
        selectedSupplierCatalog: Array<{
            товар_id: number;
            название: string;
            артикул: string;
            единица_измерения: string;
            категория?: string;
            цена: number;
            срок_поставки: number;
        }>;
    }
    | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponsePayload>) {
    const actor = await requirePermission(req, res, 'purchases.create');
    if (!actor) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
        return;
    }

    try {
        const positions = normalizeSupplierAssortmentPositions(req.body?.positions);
        const supplierId = Number(req.body?.supplierId) || 0;
        const settings = await getSupplierAssortmentSettings();
        const recommendations = settings.useSupplierAssortment
            ? await getSupplierRecommendationsForPositions(positions)
            : [];
        const selectedSupplierAssortment = settings.useSupplierAssortment && supplierId > 0
            ? Object.fromEntries(
                Array.from((await getSupplierAssortmentMapForSupplier(supplierId, positions)).entries())
                    .map(([productId, item]) => [
                        String(productId),
                        { цена: item.цена, срок_поставки: item.срок_поставки },
                    ])
            )
            : {};
        const selectedSupplierCatalog = settings.useSupplierAssortment && supplierId > 0
            ? await getSupplierAssortmentCatalog(supplierId)
            : [];

        res.status(200).json({
            settings,
            recommendations,
            selectedSupplierAssortment,
            selectedSupplierCatalog,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Не удалось получить рекомендации по поставщикам',
        });
    }
}
