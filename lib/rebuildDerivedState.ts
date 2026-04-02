import { query, withTransaction } from './db';
import { ensureLogisticsDeliverySchema } from './logisticsDelivery';
import { recalculateShipmentDeliveryCostIfNeeded } from './shipmentDeliveryCost';
import { syncPurchaseFinanceRecord, syncStandaloneShipmentFinanceRecord } from './companyFinance';
import { syncOrderPositionsFromLinkedPurchases } from './orderFulfillment';
import { recalculateStoredOrderTotal } from './orderTotals';
import { syncOrderWorkflowStatus } from './orderWorkflow';
import { checkAndCreateMissingProducts, syncMissingProductsFromPurchases } from './missingProductsHelper';

export type RebuildDerivedStateResult = {
    ordersProcessed: number;
    purchasesProcessed: number;
    shipmentsProcessed: number;
    standaloneShipmentsProcessed: number;
    linkedShipmentFinanceDeleted: number;
};

export async function rebuildDerivedState(): Promise<RebuildDerivedStateResult> {
    await ensureLogisticsDeliverySchema();

    const snapshot = await withTransaction(async (client) => {
        const [ordersRes, purchasesRes, shipmentsRes, linkedOrderIdsRes, linkedShipmentIdsRes, standaloneShipmentIdsRes] = await Promise.all([
            client.query('SELECT id FROM public."Заявки" ORDER BY id'),
            client.query('SELECT id FROM public."Закупки" ORDER BY id'),
            client.query('SELECT id FROM public."Отгрузки" ORDER BY id'),
            client.query('SELECT DISTINCT "заявка_id" AS id FROM public."Закупки" WHERE "заявка_id" IS NOT NULL ORDER BY "заявка_id"'),
            client.query('SELECT id FROM public."Отгрузки" WHERE "заявка_id" IS NOT NULL ORDER BY id'),
            client.query('SELECT id FROM public."Отгрузки" WHERE "заявка_id" IS NULL ORDER BY id'),
        ]);

        const linkedShipmentIds = linkedShipmentIdsRes.rows
            .map((row) => Number(row.id))
            .filter((value) => Number.isFinite(value));

        if (linkedShipmentIds.length > 0) {
            await client.query(
                'DELETE FROM public."Финансы_компании" WHERE "отгрузка_id" = ANY($1::int[])',
                [linkedShipmentIds]
            );
        }

        return {
            orderIds: ordersRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value)),
            purchaseIds: purchasesRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value)),
            shipmentIds: shipmentsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value)),
            linkedOrderIds: linkedOrderIdsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value)),
            standaloneShipmentIds: standaloneShipmentIdsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value)),
            linkedShipmentFinanceDeleted: linkedShipmentIds.length,
        };
    });

    for (const purchaseId of snapshot.purchaseIds) {
        await withTransaction(async (client) => {
            await syncPurchaseFinanceRecord({ query: client.query.bind(client) }, purchaseId);
        });
    }

    for (const shipmentId of snapshot.shipmentIds) {
        await withTransaction(async (client) => {
            await recalculateShipmentDeliveryCostIfNeeded({ query: client.query.bind(client) }, shipmentId);
        });
    }

    for (const shipmentId of snapshot.standaloneShipmentIds) {
        await withTransaction(async (client) => {
            await syncStandaloneShipmentFinanceRecord({ query: client.query.bind(client) }, shipmentId);
        });
    }

    for (const orderId of snapshot.linkedOrderIds) {
        await withTransaction(async (client) => {
            await syncOrderPositionsFromLinkedPurchases({ query: client.query.bind(client) }, orderId);
        });
    }

    for (const orderId of snapshot.orderIds) {
        await recalculateStoredOrderTotal({ query }, orderId);
        await checkAndCreateMissingProducts(orderId);
        await syncMissingProductsFromPurchases(orderId);
        await syncOrderWorkflowStatus(orderId);
    }

    return {
        ordersProcessed: snapshot.orderIds.length,
        purchasesProcessed: snapshot.purchaseIds.length,
        shipmentsProcessed: snapshot.shipmentIds.length,
        standaloneShipmentsProcessed: snapshot.standaloneShipmentIds.length,
        linkedShipmentFinanceDeleted: snapshot.linkedShipmentFinanceDeleted,
    };
}
