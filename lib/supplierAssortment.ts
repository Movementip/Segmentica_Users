import { query } from './db';
import { getUseSupplierAssortment, getUseSupplierLeadTime } from './appSettings';

type QueryResultRow = Record<string, any>;
type QueryResultLike = { rows: QueryResultRow[]; rowCount?: number | null };
type QueryRunner = (text: string, params?: any[]) => Promise<QueryResultLike>;

export interface SupplierAssortmentSettings {
    useSupplierAssortment: boolean;
    useSupplierLeadTime: boolean;
}

export interface SupplierAssortmentPositionInput {
    товар_id: number;
    количество?: number;
    цена?: number;
}

export interface SupplierAssortmentLine {
    товар_id: number;
    цена: number;
    срок_поставки: number;
}

export interface SupplierAssortmentCatalogItem extends SupplierAssortmentLine {
    название: string;
    артикул: string;
    единица_измерения: string;
    категория?: string;
}

export interface SupplierRecommendation {
    supplierId: number;
    supplierName: string;
    matchedCount: number;
    totalRequested: number;
    fullyMatches: boolean;
    missingProductIds: number[];
    totalPrice: number | null;
    maxLeadTimeDays: number | null;
    positions: SupplierAssortmentLine[];
}

const normalizeProductId = (value: unknown) => {
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
};

export const normalizeSupplierAssortmentPositions = (
    positions: Array<Partial<SupplierAssortmentPositionInput>> | undefined | null
): SupplierAssortmentPositionInput[] => {
    if (!Array.isArray(positions)) return [];

    return positions
        .map((item) => {
            const товар_id = normalizeProductId(item?.товар_id);
            const количество = Math.max(1, Number(item?.количество) || 1);
            const цена = Number(item?.цена) || 0;
            return { товар_id, количество, цена };
        })
        .filter((item) => item.товар_id > 0);
};

export const getSupplierAssortmentSettings = async (): Promise<SupplierAssortmentSettings> => {
    const [useSupplierAssortment, useSupplierLeadTime] = await Promise.all([
        getUseSupplierAssortment(),
        getUseSupplierLeadTime(),
    ]);

    return {
        useSupplierAssortment,
        useSupplierLeadTime: useSupplierAssortment && useSupplierLeadTime,
    };
};

const getDistinctRequestedProductIds = (positions: SupplierAssortmentPositionInput[]) => (
    Array.from(
        new Set(
            positions
                .map((item) => normalizeProductId(item.товар_id))
                .filter((item) => item > 0)
        )
    )
);

const getRequestedQuantityByProductId = (positions: SupplierAssortmentPositionInput[]) => {
    const quantityByProductId = new Map<number, number>();
    for (const position of positions) {
        const productId = normalizeProductId(position.товар_id);
        if (!productId) continue;
        quantityByProductId.set(productId, Math.max(1, Number(position.количество) || 1));
    }
    return quantityByProductId;
};

export const getSupplierRecommendationsForPositions = async (
    rawPositions: Array<Partial<SupplierAssortmentPositionInput>> | undefined | null,
    queryFn: QueryRunner = query
): Promise<SupplierRecommendation[]> => {
    const positions = normalizeSupplierAssortmentPositions(rawPositions);
    const requestedProductIds = getDistinctRequestedProductIds(positions);
    if (requestedProductIds.length === 0) return [];

    const quantityByProductId = getRequestedQuantityByProductId(positions);
    const assortmentResult = await queryFn(
        `
            SELECT
                suppliers.id AS supplier_id,
                suppliers."название" AS supplier_name,
                assortment."товар_id",
                assortment."цена",
                COALESCE(assortment."срок_поставки", 0) AS "срок_поставки"
            FROM public."Ассортимент_поставщиков" assortment
            INNER JOIN public."Поставщики" suppliers
                ON suppliers.id = assortment."поставщик_id"
            WHERE assortment."товар_id" = ANY($1::int[])
            ORDER BY suppliers."название" ASC, assortment."товар_id" ASC
        `,
        [requestedProductIds]
    );

    const recommendationsBySupplierId = new Map<number, SupplierRecommendation>();

    for (const row of assortmentResult.rows) {
        const supplierId = normalizeProductId(row.supplier_id);
        const supplierName = String(row.supplier_name || '').trim();
        const productId = normalizeProductId(row.товар_id);
        if (!supplierId || !supplierName || !productId) continue;

        const existing = recommendationsBySupplierId.get(supplierId) || {
            supplierId,
            supplierName,
            matchedCount: 0,
            totalRequested: requestedProductIds.length,
            fullyMatches: false,
            missingProductIds: [],
            totalPrice: 0,
            maxLeadTimeDays: 0,
            positions: [],
        };

        if (!existing.positions.some((item) => item.товар_id === productId)) {
            const price = Number(row.цена) || 0;
            const leadTime = Math.max(0, Number(row.срок_поставки) || 0);
            existing.positions.push({
                товар_id: productId,
                цена: price,
                срок_поставки: leadTime,
            });
            existing.matchedCount += 1;
            existing.totalPrice = (existing.totalPrice || 0) + price * (quantityByProductId.get(productId) || 1);
            existing.maxLeadTimeDays = Math.max(existing.maxLeadTimeDays || 0, leadTime);
        }

        recommendationsBySupplierId.set(supplierId, existing);
    }

    return Array.from(recommendationsBySupplierId.values())
        .map((item) => {
            const missingProductIds = requestedProductIds.filter((productId) => !item.positions.some((pos) => pos.товар_id === productId));
            return {
                ...item,
                missingProductIds,
                fullyMatches: missingProductIds.length === 0,
                totalPrice: item.positions.length > 0 ? Number(item.totalPrice) || 0 : null,
                maxLeadTimeDays: item.positions.length > 0 ? Number(item.maxLeadTimeDays) || 0 : null,
            };
        })
        .sort((left, right) => {
            if (left.fullyMatches !== right.fullyMatches) return left.fullyMatches ? -1 : 1;
            if (left.matchedCount !== right.matchedCount) return right.matchedCount - left.matchedCount;

            const leftPrice = left.totalPrice == null ? Number.POSITIVE_INFINITY : left.totalPrice;
            const rightPrice = right.totalPrice == null ? Number.POSITIVE_INFINITY : right.totalPrice;
            if (leftPrice !== rightPrice) return leftPrice - rightPrice;

            const leftLeadTime = left.maxLeadTimeDays == null ? Number.POSITIVE_INFINITY : left.maxLeadTimeDays;
            const rightLeadTime = right.maxLeadTimeDays == null ? Number.POSITIVE_INFINITY : right.maxLeadTimeDays;
            if (leftLeadTime !== rightLeadTime) return leftLeadTime - rightLeadTime;

            return left.supplierName.localeCompare(right.supplierName, 'ru-RU');
        });
};

export const getSupplierAssortmentMapForSupplier = async (
    supplierId: number,
    rawPositions: Array<Partial<SupplierAssortmentPositionInput>> | undefined | null,
    queryFn: QueryRunner = query
): Promise<Map<number, SupplierAssortmentLine>> => {
    const normalizedSupplierId = normalizeProductId(supplierId);
    const requestedProductIds = getDistinctRequestedProductIds(normalizeSupplierAssortmentPositions(rawPositions));
    const assortmentMap = new Map<number, SupplierAssortmentLine>();

    if (!normalizedSupplierId || requestedProductIds.length === 0) {
        return assortmentMap;
    }

    const assortmentResult = await queryFn(
        `
            SELECT
                assortment."товар_id",
                assortment."цена",
                COALESCE(assortment."срок_поставки", 0) AS "срок_поставки"
            FROM public."Ассортимент_поставщиков" assortment
            WHERE assortment."поставщик_id" = $1
              AND assortment."товар_id" = ANY($2::int[])
        `,
        [normalizedSupplierId, requestedProductIds]
    );

    for (const row of assortmentResult.rows) {
        const productId = normalizeProductId(row.товар_id);
        if (!productId) continue;
        assortmentMap.set(productId, {
            товар_id: productId,
            цена: Number(row.цена) || 0,
            срок_поставки: Math.max(0, Number(row.срок_поставки) || 0),
        });
    }

    return assortmentMap;
};

export const getProductNamesByIds = async (
    productIds: number[],
    queryFn: QueryRunner = query
): Promise<Map<number, string>> => {
    const normalizedIds = Array.from(new Set(productIds.map(normalizeProductId).filter((item) => item > 0)));
    const result = new Map<number, string>();

    if (normalizedIds.length === 0) return result;

    const productsResult = await queryFn(
        `
            SELECT id, "название", "артикул"
            FROM public."Товары"
            WHERE id = ANY($1::int[])
        `,
        [normalizedIds]
    );

    for (const row of productsResult.rows) {
        const id = normalizeProductId(row.id);
        if (!id) continue;
        const name = String(row.название || '').trim();
        const article = String(row.артикул || '').trim();
        result.set(id, article ? `${name} (${article})` : name || `Товар #${id}`);
    }

    return result;
};

export const getSupplierAssortmentCatalog = async (
    supplierId: number,
    queryFn: QueryRunner = query
): Promise<SupplierAssortmentCatalogItem[]> => {
    const normalizedSupplierId = normalizeProductId(supplierId);
    if (!normalizedSupplierId) return [];

    const assortmentResult = await queryFn(
        `
            SELECT
                assortment."товар_id",
                assortment."цена",
                COALESCE(assortment."срок_поставки", 0) AS "срок_поставки",
                products."название",
                products."артикул",
                products."единица_измерения",
                products."категория"
            FROM public."Ассортимент_поставщиков" assortment
            INNER JOIN public."Товары" products
                ON products.id = assortment."товар_id"
            WHERE assortment."поставщик_id" = $1
            ORDER BY products."название" ASC, products."артикул" ASC
        `,
        [normalizedSupplierId]
    );

    const items: SupplierAssortmentCatalogItem[] = [];

    for (const row of assortmentResult.rows) {
        const productId = normalizeProductId(row.товар_id);
        if (!productId) continue;

        items.push({
            товар_id: productId,
            цена: Number(row.цена) || 0,
            срок_поставки: Math.max(0, Number(row.срок_поставки) || 0),
            название: String(row.название || '').trim(),
            артикул: String(row.артикул || '').trim(),
            единица_измерения: String(row.единица_измерения || 'шт').trim() || 'шт',
            категория: row.категория == null ? undefined : String(row.категория),
        });
    }

    return items;
};
