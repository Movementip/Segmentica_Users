import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { hasPermission, requireAuth } from '../../lib/auth';
import { getDashboardAccess } from '../../lib/dashboardRbac';
import { REPORT_TAB_PERMISSIONS } from '../../lib/reportsRbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const actor = await requireAuth(req, res);
    if (!actor) return;

    const access = getDashboardAccess(actor.permissions);
    const canSalesSeries =
        access.canSalesChart ||
        hasPermission(actor, REPORT_TAB_PERMISSIONS.overview) ||
        hasPermission(actor, REPORT_TAB_PERMISSIONS.sales);
    const canWarehouseMovements =
        access.canWarehouseMovements ||
        hasPermission(actor, 'reports.custom.warehouse_movements.view');

    const canUseDashboardApi = Boolean(
        access.statsCards.activeOrders ||
        access.statsCards.totalProducts ||
        access.statsCards.activeSuppliers ||
        access.statsCards.lowStockItems ||
        access.canRecentOrders ||
        access.canStockByCategory ||
        canSalesSeries ||
        canWarehouseMovements
    );

    if (!canUseDashboardApi) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const needActiveOrders = access.statsCards.activeOrders || access.canRecentOrders;
        const needTotalProducts = access.statsCards.totalProducts;
        const needActiveSuppliers = access.statsCards.activeSuppliers;
        const needLowStockItems = access.statsCards.lowStockItems;
        const needRecentOrders = access.canRecentOrders;
        const needStockByCategory = access.canStockByCategory;
        const needSalesByPeriod = canSalesSeries;
        const needWarehouseMovements = canWarehouseMovements;

        const [
            activeOrdersResult,
            productsResult,
            suppliersResult,
            lowStockResult,
            recentOrdersResult,
            stockByCategoryResult,
            salesByPeriodResult,
            warehouseMovementsResult,
        ] = await Promise.all([
            needActiveOrders
                ? query(
                    `SELECT COUNT(*) as count
                     FROM "Заявки"
                     WHERE "статус" NOT IN ('выполнена', 'отменена')`
                )
                : Promise.resolve(null),
            needTotalProducts
                ? query('SELECT COUNT(*) as count FROM "Товары"')
                : Promise.resolve(null),
            needActiveSuppliers
                ? query('SELECT COUNT(DISTINCT "поставщик_id") as count FROM "Ассортимент_поставщиков"')
                : Promise.resolve(null),
            needLowStockItems
                ? query(
                    `SELECT COUNT(*) as count
                     FROM "Товары" t
                     JOIN "Склад" s ON t.id = s."товар_id"
                     WHERE s."количество" <= t."минимальный_остаток"`
                )
                : Promise.resolve(null),
            needRecentOrders
                ? query(
                    `SELECT
                        z.id,
                        k."название" as client,
                        (
                          COALESCE(order_totals.items_total, 0)
                          + COALESCE(purchase_logistics.purchase_delivery_total, 0)
                          + COALESCE(shipment_logistics.shipment_delivery_total, 0)
                        )::numeric as amount,
                        z."статус" as status,
                        z."дата_создания" as created_at
                     FROM "Заявки" z
                     JOIN "Клиенты" k ON z."клиент_id" = k.id
                     LEFT JOIN (
                        SELECT
                            positions."заявка_id",
                            SUM(
                                COALESCE(positions."количество", 0)
                                * COALESCE(positions."цена", 0)
                                * (1 + COALESCE(vat."ставка", 0) / 100.0)
                            )::numeric as items_total
                        FROM "Позиции_заявки" positions
                        LEFT JOIN "Ставки_НДС" vat ON vat.id = positions."ндс_id"
                        GROUP BY positions."заявка_id"
                     ) order_totals ON order_totals."заявка_id" = z.id
                     LEFT JOIN (
                        SELECT
                            purchases."заявка_id",
                            SUM(
                                CASE
                                    WHEN COALESCE(purchases."использовать_доставку", false)
                                      AND COALESCE(purchases."статус", 'заказано') <> 'отменено'
                                      THEN COALESCE(purchases."стоимость_доставки", 0)
                                    ELSE 0
                                END
                            )::numeric as purchase_delivery_total
                        FROM "Закупки" purchases
                        GROUP BY purchases."заявка_id"
                     ) purchase_logistics ON purchase_logistics."заявка_id" = z.id
                     LEFT JOIN (
                        SELECT
                            shipments."заявка_id",
                            SUM(
                                CASE
                                    WHEN COALESCE(shipments."использовать_доставку", true)
                                      AND COALESCE(shipments."статус", 'в пути') <> 'отменено'
                                      THEN COALESCE(shipments."стоимость_доставки", 0)
                                    ELSE 0
                                END
                            )::numeric as shipment_delivery_total
                        FROM "Отгрузки" shipments
                        GROUP BY shipments."заявка_id"
                     ) shipment_logistics ON shipment_logistics."заявка_id" = z.id
                     ORDER BY z."дата_создания" DESC
                     LIMIT 5`
                )
                : Promise.resolve(null),
            needStockByCategory
                ? query(
                    `SELECT
                        k."название" as category,
                        COUNT(t.id) as count,
                        COALESCE(SUM(s."количество"), 0) as total_quantity
                     FROM "Товары" t
                     JOIN "Категории_товаров" k ON t."категория_id" = k.id
                     LEFT JOIN "Склад" s ON t.id = s."товар_id"
                     WHERE s."количество" > 0
                     GROUP BY k."название"
                     ORDER BY count DESC`
                )
                : Promise.resolve(null),
            needSalesByPeriod
                ? query(
                    `SELECT
                        TO_CHAR(DATE_TRUNC('month', z."дата_создания")::date, 'YYYY-MM-DD') as "период",
                        COUNT(*) as "количество_продаж",
                        COALESCE(SUM(
                            COALESCE(order_totals.items_total, 0)
                            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
                            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
                        ), 0) as "общая_сумма",
                        CASE
                            WHEN COUNT(*) > 0 THEN COALESCE(SUM(
                                COALESCE(order_totals.items_total, 0)
                                + COALESCE(purchase_logistics.purchase_delivery_total, 0)
                                + COALESCE(shipment_logistics.shipment_delivery_total, 0)
                            ) / COUNT(*), 0)
                            ELSE 0
                        END as "средний_чек"
                     FROM "Заявки" z
                     LEFT JOIN (
                        SELECT
                            positions."заявка_id",
                            SUM(
                                COALESCE(positions."количество", 0)
                                * COALESCE(positions."цена", 0)
                                * (1 + COALESCE(vat."ставка", 0) / 100.0)
                            )::numeric as items_total
                        FROM "Позиции_заявки" positions
                        LEFT JOIN "Ставки_НДС" vat ON vat.id = positions."ндс_id"
                        GROUP BY positions."заявка_id"
                     ) order_totals ON order_totals."заявка_id" = z.id
                     LEFT JOIN (
                        SELECT
                            purchases."заявка_id",
                            SUM(
                                CASE
                                    WHEN COALESCE(purchases."использовать_доставку", false)
                                      AND COALESCE(purchases."статус", 'заказано') <> 'отменено'
                                      THEN COALESCE(purchases."стоимость_доставки", 0)
                                    ELSE 0
                                END
                            )::numeric as purchase_delivery_total
                        FROM "Закупки" purchases
                        GROUP BY purchases."заявка_id"
                     ) purchase_logistics ON purchase_logistics."заявка_id" = z.id
                     LEFT JOIN (
                        SELECT
                            shipments."заявка_id",
                            SUM(
                                CASE
                                    WHEN COALESCE(shipments."использовать_доставку", true)
                                      AND COALESCE(shipments."статус", 'в пути') <> 'отменено'
                                      THEN COALESCE(shipments."стоимость_доставки", 0)
                                    ELSE 0
                                END
                            )::numeric as shipment_delivery_total
                        FROM "Отгрузки" shipments
                        GROUP BY shipments."заявка_id"
                     ) shipment_logistics ON shipment_logistics."заявка_id" = z.id
                     WHERE z."статус" IN ('выполнена', 'выполнено')
                     GROUP BY DATE_TRUNC('month', z."дата_создания")
                     ORDER BY "период" DESC
                     LIMIT 6`
                )
                : Promise.resolve(null),
            needWarehouseMovements
                ? query(
                    `SELECT
                        ds.id,
                        t."название" as product_name,
                        ds."количество" as quantity,
                        ds."тип_операции" as operation_type,
                        ds."дата_операции" as operation_date,
                        ds."комментарий" as comment,
                        COALESCE(z.id::text, 'Нет') as order_id,
                        COALESCE(po.id::text, 'Нет') as purchase_id
                     FROM "Движения_склада" ds
                     JOIN "Товары" t ON ds."товар_id" = t.id
                     LEFT JOIN "Заявки" z ON ds."заявка_id" = z.id
                     LEFT JOIN "Закупки" po ON ds."закупка_id" = po.id
                     ORDER BY ds."дата_операции" DESC
                     LIMIT 10`
                )
                : Promise.resolve(null),
        ]);

        const data = {
            activeOrders: needActiveOrders ? parseInt(activeOrdersResult?.rows?.[0]?.count || '0', 10) || 0 : 0,
            totalProducts: needTotalProducts ? parseInt(productsResult?.rows?.[0]?.count || '0', 10) || 0 : 0,
            activeSuppliers: needActiveSuppliers ? parseInt(suppliersResult?.rows?.[0]?.count || '0', 10) || 0 : 0,
            lowStockItems: needLowStockItems ? parseInt(lowStockResult?.rows?.[0]?.count || '0', 10) || 0 : 0,
            recentOrders: needRecentOrders
                ? (recentOrdersResult?.rows || []).map((order) => ({
                    ...order,
                    amount: parseFloat(order.amount) || 0,
                    created_at: new Date(order.created_at).toISOString()
                }))
                : [],
            stockByCategory: needStockByCategory
                ? (stockByCategoryResult?.rows || []).map((item) => ({
                    category: item.category,
                    count: parseInt(item.count, 10) || 0
                }))
                : [],
            salesByPeriod: needSalesByPeriod ? (salesByPeriodResult?.rows || []) : [],
            warehouseMovements: needWarehouseMovements
                ? (warehouseMovementsResult?.rows || []).map((item) => ({
                    id: item.id,
                    product_name: item.product_name,
                    quantity: Number(item.quantity) || 0,
                    operation_type: item.operation_type,
                    operation_date: new Date(item.operation_date).toISOString(),
                    comment: item.comment,
                    order_id: item.order_id,
                    purchase_id: item.purchase_id
                }))
                : [],
            monthlyRevenue: 0,
            pendingShipments: 0,
        };

        return res.status(200).json(data);
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ message: 'Error fetching dashboard data' });
    }
}
