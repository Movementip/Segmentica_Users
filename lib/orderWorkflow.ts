import { query } from './db';
import { normalizeFulfillmentStatus } from './orderFulfillment';
import {
    normalizeOrderExecutionMode,
    normalizeOrderSupplyMode,
    type OrderExecutionMode,
    type OrderSupplyMode,
} from './orderModes';

export interface OrderWorkflowPositionSummary {
    товар_id: number;
    товар_название: string;
    товар_артикул?: string;
    способ_обеспечения: OrderSupplyMode;
    необходимое_количество: number;
    склад_количество: number;
    активная_недостача: number;
    закуплено_количество: number;
    осталось_закупить: number;
    покрыто_со_склада: number;
    собранное_количество: number;
    отгруженное_количество: number;
    доставленное_количество: number;
    осталось_собрать: number;
    осталось_отгрузить: number;
}

export interface OrderWorkflowMissingSummary {
    id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
}

export interface OrderWorkflowPurchaseSummary {
    id: number;
    статус: string;
    дата_заказа?: string;
    общая_сумма?: number;
    использовать_доставку?: boolean;
    стоимость_доставки?: number;
}

export interface OrderWorkflowShipmentSummary {
    id: number;
    branchNo: number;
    shipmentKind: string;
    статус: string;
    дата_отгрузки?: string;
    номер_отслеживания?: string;
    стоимость_доставки?: number;
    транспорт_название?: string;
    totalUnits: number;
}

export interface OrderWorkflowAssemblyBatchSummary {
    id: number;
    branchNo: number;
    batchType: string;
    createdAt?: string;
    totalUnits: number;
    positions: Array<{
        товар_id: number;
        товар_название: string;
        quantity: number;
    }>;
}

export interface OrderWorkflowSummary {
    orderId: number;
    executionMode: OrderExecutionMode;
    currentStatus: string;
    derivedStatus: string;
    positionCount: number;
    positions: OrderWorkflowPositionSummary[];
    missingProducts: OrderWorkflowMissingSummary[];
    purchases: OrderWorkflowPurchaseSummary[];
    shipments: OrderWorkflowShipmentSummary[];
    assemblyBatches: OrderWorkflowAssemblyBatchSummary[];
    activeMissingCount: number;
    missingUnits: number;
    missingOrderedCount: number;
    missingProcessingCount: number;
    purchaseCount: number;
    activePurchaseCount: number;
    shipmentCount: number;
    activeShipmentCount: number;
    deliveredShipmentCount: number;
    assemblyBatchCount: number;
    isAssembled: boolean;
    readyForAssembly: boolean;
    canAssemble: boolean;
    readyForShipment: boolean;
    canCreateShipment: boolean;
    canCreatePurchase: boolean;
    canComplete: boolean;
    hasAssemblyHistory: boolean;
    hasShipmentHistory: boolean;
    coveredFromStockUnits: number;
    warehouseTakenUnits: number;
    assembledUnits: number;
    shippedUnits: number;
    deliveredUnits: number;
    remainingAssemblyUnits: number;
    remainingShipmentUnits: number;
    nextAssemblyActionLabel: string | null;
    nextShipmentActionLabel: string | null;
}

const normalizeStatus = (value?: string | null) => normalizeFulfillmentStatus(value);

const mapWorkflowStatusToOrderStatus = (value?: string | null): string => {
    const status = normalizeStatus(value);

    switch (status) {
        case 'досборка':
            return 'в работе';
        case 'доотгрузка':
            return 'отгружена';
        default:
            return value || 'новая';
    }
};

export function deriveOrderWorkflowStatus(summary: Pick<OrderWorkflowSummary, 'currentStatus' | 'positionCount' | 'activePurchaseCount' | 'activeMissingCount' | 'shipmentCount' | 'activeShipmentCount' | 'deliveredShipmentCount' | 'assemblyBatchCount' | 'isAssembled' | 'canComplete' | 'remainingAssemblyUnits' | 'remainingShipmentUnits' | 'shippedUnits'>): string {
    const current = normalizeStatus(summary.currentStatus);

    if (current === 'отменена') {
        return 'отменена';
    }

    if (current === 'выполнена' && summary.canComplete) {
        return 'выполнена';
    }

    if (summary.assemblyBatchCount > 0 && summary.remainingAssemblyUnits > 0) {
        return 'досборка';
    }

    if (summary.shipmentCount > 0 && summary.remainingShipmentUnits > 0 && summary.shippedUnits > 0) {
        return 'доотгрузка';
    }

    if (summary.activeShipmentCount > 0 || summary.deliveredShipmentCount > 0 || summary.shippedUnits > 0) {
        return 'отгружена';
    }

    if (summary.isAssembled) {
        return 'собрана';
    }

    if (summary.activePurchaseCount > 0 || summary.activeMissingCount > 0 || summary.positionCount > 0) {
        return 'в работе';
    }

    if (['подтверждена', 'в обработке', 'новая', 'в работе'].includes(current)) {
        return current;
    }

    return 'новая';
}

export async function getOrderWorkflowSummary(orderId: number): Promise<OrderWorkflowSummary> {
    const orderResult = await query(
        'SELECT id, "статус", "режим_исполнения" FROM "Заявки" WHERE id = $1 LIMIT 1',
        [orderId]
    );

    if (orderResult.rows.length === 0) {
        throw new Error('Заявка не найдена');
    }

    const executionMode = normalizeOrderExecutionMode(orderResult.rows[0]?.режим_исполнения);

    const [
        positionsResult,
        missingProductsResult,
        purchasesResult,
        shipmentsResult,
        assemblyBatchesResult,
        assemblyBatchPositionsResult,
        warehouseUsageResult,
    ] = await Promise.all([
        query(
            `
                SELECT
                    order_positions."товар_id",
                    COALESCE(products."название", CONCAT('Товар #', order_positions."товар_id")) AS товар_название,
                    products."артикул" AS товар_артикул,
                    COALESCE(order_positions."способ_обеспечения", 'auto') AS способ_обеспечения,
                    COALESCE(order_positions."количество", 0)::numeric AS необходимое_количество,
                    COALESCE(stock."количество", 0)::numeric AS склад_количество,
                    COALESCE(missing.active_missing_qty, 0)::numeric AS активная_недостача,
                    COALESCE(purchases.purchased_qty, 0)::numeric AS закуплено_количество,
                    COALESCE(assembled.assembled_qty, 0)::numeric AS собранное_количество,
                    COALESCE(shipped.shipped_qty, 0)::numeric AS отгруженное_количество,
                    COALESCE(shipped.delivered_qty, 0)::numeric AS доставленное_количество
                FROM "Позиции_заявки" order_positions
                LEFT JOIN "Товары" products
                    ON products.id = order_positions."товар_id"
                LEFT JOIN "Склад" stock
                    ON stock."товар_id" = order_positions."товар_id"
                LEFT JOIN (
                    SELECT
                        "заявка_id",
                        "товар_id",
                        SUM("недостающее_количество")::numeric AS active_missing_qty
                    FROM "Недостающие_товары"
                    WHERE "заявка_id" = $1
                      AND COALESCE("активна", true) = true
                      AND COALESCE("недостающее_количество", 0) > 0
                      AND COALESCE("статус", 'в обработке') != 'получено'
                    GROUP BY "заявка_id", "товар_id"
                ) missing
                    ON missing."заявка_id" = order_positions."заявка_id"
                   AND missing."товар_id" = order_positions."товар_id"
                LEFT JOIN (
                    SELECT
                        purchase_positions."товар_id",
                        SUM(COALESCE(purchase_positions."количество", 0))::numeric AS purchased_qty
                    FROM "Закупки" purchases
                    INNER JOIN "Позиции_закупки" purchase_positions
                        ON purchase_positions."закупка_id" = purchases.id
                    WHERE purchases."заявка_id" = $1
                      AND COALESCE(purchases."статус", 'заказано') != 'отменено'
                    GROUP BY purchase_positions."товар_id"
                ) purchases
                    ON purchases."товар_id" = order_positions."товар_id"
                LEFT JOIN (
                    SELECT
                        positions.product_id,
                        SUM(positions.quantity)::numeric AS assembled_qty
                    FROM public.order_assembly_batches batches
                    INNER JOIN public.order_assembly_batch_positions positions
                        ON positions.batch_id = batches.id
                    WHERE batches.order_id = $1
                    GROUP BY positions.product_id
                ) assembled
                    ON assembled.product_id = order_positions."товар_id"
                LEFT JOIN (
                    SELECT
                        shipment_positions.product_id,
                        SUM(shipment_positions.quantity)::numeric AS shipped_qty,
                        SUM(
                            CASE
                                WHEN COALESCE(shipments."статус", 'в пути') = 'доставлено' THEN shipment_positions.quantity
                                ELSE 0
                            END
                        )::numeric AS delivered_qty
                    FROM "Отгрузки" shipments
                    INNER JOIN public.shipment_positions shipment_positions
                        ON shipment_positions.shipment_id = shipments.id
                    WHERE shipments."заявка_id" = $1
                      AND COALESCE(shipments."статус", 'в пути') != 'отменено'
                    GROUP BY shipment_positions.product_id
                ) shipped
                    ON shipped.product_id = order_positions."товар_id"
                WHERE order_positions."заявка_id" = $1
                ORDER BY order_positions.id
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    id,
                    "товар_id",
                    COALESCE("необходимое_количество", 0)::numeric AS необходимое_количество,
                    COALESCE("недостающее_количество", 0)::numeric AS недостающее_количество,
                    COALESCE("статус", 'в обработке') AS статус
                FROM "Недостающие_товары"
                WHERE "заявка_id" = $1
                  AND COALESCE("активна", true) = true
                ORDER BY id
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    purchases.id,
                    COALESCE(purchases."статус", 'заказано') AS статус,
                    purchases."дата_заказа",
                    COALESCE(purchases."использовать_доставку", false) AS использовать_доставку,
                    purchases."стоимость_доставки",
                    (
                        COALESCE(totals.total_amount, 0)
                        + CASE
                            WHEN COALESCE(purchases."использовать_доставку", false)
                                THEN COALESCE(purchases."стоимость_доставки", 0)
                            ELSE 0
                        END
                    )::numeric AS "общая_сумма"
                FROM "Закупки" purchases
                LEFT JOIN (
                    SELECT
                        purchase_positions."закупка_id",
                        SUM(
                            COALESCE(purchase_positions."количество", 0)
                            * COALESCE(purchase_positions."цена", 0)
                            * (1 + COALESCE(vat."ставка", 0) / 100.0)
                        )::numeric AS total_amount
                    FROM "Позиции_закупки" purchase_positions
                    LEFT JOIN "Ставки_НДС" vat
                        ON vat.id = purchase_positions."ндс_id"
                    GROUP BY purchase_positions."закупка_id"
                ) totals
                    ON totals."закупка_id" = purchases.id
                WHERE purchases."заявка_id" = $1
                ORDER BY purchases."дата_заказа" DESC, purchases.id DESC
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    shipments.id,
                    COALESCE(shipments.branch_no, 1)::integer AS branch_no,
                    COALESCE(shipments.shipment_kind, 'основная') AS shipment_kind,
                    COALESCE(shipments."статус", 'в пути') AS статус,
                    shipments."дата_отгрузки",
                    shipments."номер_отслеживания",
                    shipments."стоимость_доставки",
                    transports."название" AS транспорт_название,
                    COALESCE(SUM(shipment_positions.quantity), 0)::integer AS total_units
                FROM "Отгрузки" shipments
                LEFT JOIN "Транспортные_компании" transports
                    ON transports.id = shipments."транспорт_id"
                LEFT JOIN public.shipment_positions shipment_positions
                    ON shipment_positions.shipment_id = shipments.id
                WHERE shipments."заявка_id" = $1
                GROUP BY shipments.id, transports."название"
                ORDER BY COALESCE(shipments.branch_no, 1), shipments.id
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    id,
                    COALESCE(branch_no, 1)::integer AS branch_no,
                    COALESCE(batch_type, 'сборка') AS batch_type,
                    created_at
                FROM public.order_assembly_batches
                WHERE order_id = $1
                ORDER BY COALESCE(branch_no, 1), id
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    positions.batch_id,
                    positions.product_id,
                    positions.quantity,
                    COALESCE(products."название", CONCAT('Товар #', positions.product_id)) AS product_name
                FROM public.order_assembly_batch_positions positions
                INNER JOIN public.order_assembly_batches batches
                    ON batches.id = positions.batch_id
                LEFT JOIN "Товары" products
                    ON products.id = positions.product_id
                WHERE batches.order_id = $1
                ORDER BY positions.batch_id, positions.id
            `,
            [orderId]
        ),
        query(
            `
                SELECT
                    COALESCE(SUM(CASE WHEN "тип_операции" = 'расход' THEN "количество" ELSE 0 END), 0)::numeric AS warehouse_taken_units
                FROM "Движения_склада"
                WHERE "заявка_id" = $1
            `,
            [orderId]
        ),
    ]);

    const positions = positionsResult.rows.map((row: any) => {
        const supplyMode = normalizeOrderSupplyMode(row.способ_обеспечения, executionMode);
        const requiredQty = Number(row.необходимое_количество) || 0;
        const stockQty = Number(row.склад_количество) || 0;
        const activeMissingQty = Number(row.активная_недостача) || 0;
        const purchasedQty = Number(row.закуплено_количество) || 0;
        const assembledQty = Number(row.собранное_количество) || 0;
        const shippedQty = Number(row.отгруженное_количество) || 0;
        const deliveredQty = Number(row.доставленное_количество) || 0;
        const remainingToPurchase = executionMode === 'direct' && supplyMode === 'purchase'
            ? Math.max(0, requiredQty - purchasedQty)
            : 0;
        const remainingToAssemble = Math.max(0, requiredQty - assembledQty);
        const remainingToShip = Math.max(0, Math.min(requiredQty, assembledQty) - shippedQty);

        return {
            товар_id: Number(row.товар_id),
            товар_название: row.товар_название || `Товар #${row.товар_id}`,
            товар_артикул: row.товар_артикул || '',
            способ_обеспечения: supplyMode,
            необходимое_количество: requiredQty,
            склад_количество: stockQty,
            активная_недостача: activeMissingQty,
            закуплено_количество: purchasedQty,
            осталось_закупить: remainingToPurchase,
            покрыто_со_склада: executionMode === 'direct' ? 0 : Math.max(0, requiredQty - activeMissingQty),
            собранное_количество: assembledQty,
            отгруженное_количество: shippedQty,
            доставленное_количество: deliveredQty,
            осталось_собрать: remainingToAssemble,
            осталось_отгрузить: remainingToShip,
        } satisfies OrderWorkflowPositionSummary;
    });

    const missingProducts = missingProductsResult.rows.map((row: any) => ({
        id: Number(row.id),
        товар_id: Number(row.товар_id),
        необходимое_количество: Number(row.необходимое_количество) || 0,
        недостающее_количество: Number(row.недостающее_количество) || 0,
        статус: row.статус || 'в обработке',
    })) satisfies OrderWorkflowMissingSummary[];

    const purchases = purchasesResult.rows.map((row: any) => ({
        id: Number(row.id),
        статус: row.статус || 'заказано',
        дата_заказа: row.дата_заказа,
        общая_сумма: row.общая_сумма == null ? undefined : Number(row.общая_сумма),
        использовать_доставку: Boolean(row.использовать_доставку),
        стоимость_доставки: row.стоимость_доставки == null ? undefined : Number(row.стоимость_доставки),
    })) satisfies OrderWorkflowPurchaseSummary[];

    const shipments = shipmentsResult.rows.map((row: any) => ({
        id: Number(row.id),
        branchNo: Number(row.branch_no) || 1,
        shipmentKind: row.shipment_kind || 'основная',
        статус: row.статус || 'в пути',
        дата_отгрузки: row.дата_отгрузки,
        номер_отслеживания: row.номер_отслеживания || '',
        стоимость_доставки: row.стоимость_доставки == null ? undefined : Number(row.стоимость_доставки),
        транспорт_название: row.транспорт_название || '',
        totalUnits: Number(row.total_units) || 0,
    })) satisfies OrderWorkflowShipmentSummary[];

    const batchPositionsById = new Map<number, Array<{ товар_id: number; товар_название: string; quantity: number }>>();
    for (const row of assemblyBatchPositionsResult.rows) {
        const batchId = Number(row.batch_id);
        const list = batchPositionsById.get(batchId) ?? [];
        list.push({
            товар_id: Number(row.product_id),
            товар_название: row.product_name || `Товар #${row.product_id}`,
            quantity: Number(row.quantity) || 0,
        });
        batchPositionsById.set(batchId, list);
    }

    const assemblyBatches = assemblyBatchesResult.rows.map((row: any) => {
        const batchId = Number(row.id);
        const batchPositions = batchPositionsById.get(batchId) ?? [];
        return {
            id: batchId,
            branchNo: Number(row.branch_no) || 1,
            batchType: row.batch_type || 'сборка',
            createdAt: row.created_at,
            totalUnits: batchPositions.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
            positions: batchPositions,
        } satisfies OrderWorkflowAssemblyBatchSummary;
    });

    const activeMissingProducts = missingProducts.filter(
        (item) => normalizeStatus(item.статус) !== 'получено' && Number(item.недостающее_количество) > 0
    );
    const activePurchases = purchases.filter((purchase) => !['получено', 'отменено'].includes(normalizeStatus(purchase.статус)));
    const activeShipments = shipments.filter((shipment) => !['доставлено', 'отменено'].includes(normalizeStatus(shipment.статус)));
    const deliveredShipments = shipments.filter((shipment) => normalizeStatus(shipment.статус) === 'доставлено');
    const directPurchasePositions = executionMode === 'direct'
        ? positions.filter((position) => position.способ_обеспечения === 'purchase')
        : [];
    const directUncoveredPurchasePositions = directPurchasePositions.filter(
        (position) => Number(position.осталось_закупить || 0) > 0
    );

    const isAssembled = positions.length > 0
        && positions.every((position) => position.осталось_собрать <= 0);
    const readyForAssembly = positions.length > 0
        && positions.some((position) => position.осталось_собрать > 0)
        && activeMissingProducts.length === 0
        && activePurchases.length === 0
        && (executionMode !== 'direct' || directUncoveredPurchasePositions.length === 0)
        && (
            executionMode === 'direct'
            || positions.every((position) => Number(position.склад_количество) >= Number(position.осталось_собрать))
        );
    const canAssemble = readyForAssembly
        && !['отменена', 'выполнена'].includes(normalizeStatus(orderResult.rows[0].статус));

    const remainingShipmentUnits = positions.reduce((sum, position) => sum + Number(position.осталось_отгрузить || 0), 0);
    const remainingAssemblyUnits = positions.reduce((sum, position) => sum + Number(position.осталось_собрать || 0), 0);
    const assembledUnits = positions.reduce((sum, position) => sum + Number(position.собранное_количество || 0), 0);
    const shippedUnits = positions.reduce((sum, position) => sum + Number(position.отгруженное_количество || 0), 0);
    const deliveredUnits = positions.reduce((sum, position) => sum + Number(position.доставленное_количество || 0), 0);

    const readyForShipment = remainingShipmentUnits > 0;
    const canCreateShipment = readyForShipment
        && isAssembled
        && !['отменена', 'выполнена'].includes(normalizeStatus(orderResult.rows[0].статус));
    const canCreatePurchase = executionMode === 'direct'
        ? directUncoveredPurchasePositions.length > 0
            && activePurchases.length === 0
            && !['отменена', 'выполнена'].includes(normalizeStatus(orderResult.rows[0].статус))
        : activeMissingProducts.length > 0
            && !['отменена', 'выполнена'].includes(normalizeStatus(orderResult.rows[0].статус));
    const canComplete = positions.length > 0
        && positions.every((position) => Number(position.доставленное_количество) >= Number(position.необходимое_количество))
        && activeMissingProducts.length === 0
        && activePurchases.length === 0
        && activeShipments.length === 0;

    const summaryBase = {
        currentStatus: orderResult.rows[0].статус || 'новая',
        positionCount: positions.length,
        activePurchaseCount: activePurchases.length,
        activeMissingCount: activeMissingProducts.length,
        shipmentCount: shipments.length,
        activeShipmentCount: activeShipments.length,
        deliveredShipmentCount: deliveredShipments.length,
        assemblyBatchCount: assemblyBatches.length,
        isAssembled,
        canComplete,
        remainingAssemblyUnits,
        remainingShipmentUnits,
        shippedUnits,
    };

    const derivedStatus = deriveOrderWorkflowStatus(summaryBase);

    return {
        orderId,
        executionMode,
        currentStatus: summaryBase.currentStatus,
        derivedStatus,
        positionCount: positions.length,
        positions,
        missingProducts,
        purchases,
        shipments,
        assemblyBatches,
        activeMissingCount: activeMissingProducts.length,
        missingUnits: activeMissingProducts.reduce((sum, item) => sum + Number(item.недостающее_количество || 0), 0),
        missingOrderedCount: activeMissingProducts.filter((item) => normalizeStatus(item.статус) === 'заказано').length,
        missingProcessingCount: activeMissingProducts.filter((item) => ['в обработке', 'в пути'].includes(normalizeStatus(item.статус))).length,
        purchaseCount: purchases.length,
        activePurchaseCount: activePurchases.length,
        shipmentCount: shipments.length,
        activeShipmentCount: activeShipments.length,
        deliveredShipmentCount: deliveredShipments.length,
        assemblyBatchCount: assemblyBatches.length,
        isAssembled,
        readyForAssembly,
        canAssemble,
        readyForShipment,
        canCreateShipment,
        canCreatePurchase,
        canComplete,
        hasAssemblyHistory: assemblyBatches.length > 0,
        hasShipmentHistory: shipments.length > 0,
        coveredFromStockUnits: positions.reduce((sum, position) => sum + Number(position.покрыто_со_склада || 0), 0),
        warehouseTakenUnits: Number(warehouseUsageResult.rows[0]?.warehouse_taken_units) || 0,
        assembledUnits,
        shippedUnits,
        deliveredUnits,
        remainingAssemblyUnits,
        remainingShipmentUnits,
        nextAssemblyActionLabel: canAssemble ? (assemblyBatches.length > 0 ? 'Дособрать заявку' : 'Собрать заявку') : null,
        nextShipmentActionLabel: canCreateShipment ? (shipments.length > 0 ? 'Создать доотгрузку' : 'Создать отгрузку') : null,
    };
}

export async function syncOrderWorkflowStatus(orderId: number): Promise<OrderWorkflowSummary> {
    const summary = await getOrderWorkflowSummary(orderId);
    const currentStored = normalizeStatus(summary.currentStatus);
    const nextWorkflow = normalizeStatus(summary.derivedStatus);
    const nextStored = normalizeStatus(mapWorkflowStatusToOrderStatus(summary.derivedStatus));

    if (currentStored !== 'отменена' && nextStored && nextStored !== currentStored) {
        await query(
            'UPDATE "Заявки" SET "статус" = $1 WHERE id = $2',
            [mapWorkflowStatusToOrderStatus(summary.derivedStatus), orderId]
        );
    }

    return {
        ...summary,
        currentStatus: nextWorkflow || summary.currentStatus,
    };
}
