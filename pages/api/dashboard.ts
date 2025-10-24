import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Get active orders count
        const activeOrdersResult = await query(
            `SELECT COUNT(*) as count 
       FROM "Заявки" 
       WHERE "статус" NOT IN ('выполнена', 'отменена')`
        );

        // Get total products count
        const productsResult = await query('SELECT COUNT(*) as count FROM "Товары"');

        // Get active suppliers count
        const suppliersResult = await query(
            'SELECT COUNT(DISTINCT "поставщик_id") as count FROM "Ассортимент_поставщиков"'
        );

        // Get low stock items count (quantity < minimum_quantity)
        const lowStockResult = await query(
            `SELECT COUNT(*) as count 
       FROM "Товары" t
       JOIN "Склад" s ON t.id = s."товар_id"
       WHERE s."количество" <= t."минимальный_остаток" AND s."количество" > 0`
        );

        // Get recent orders with client names
        const recentOrdersResult = await query(
            `SELECT 
               z.id, 
               k."название" as client, 
               z."общая_сумма" as amount, 
               z."статус" as status, 
               z."дата_создания" as created_at 
             FROM "Заявки" z
             JOIN "Клиенты" k ON z."клиент_id" = k.id
             ORDER BY z."дата_создания" DESC
             LIMIT 5`
        );

        // Get stock by category
        const stockByCategoryResult = await query(
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
        );

        const salesByPeriod = await query(`
    SELECT 
        TO_CHAR(DATE_TRUNC('month', "дата_создания")::date, 'YYYY-MM-DD') as "период",
        COUNT(*) as "количество_продаж",
        COALESCE(SUM("общая_сумма"), 0) as "общая_сумма",
        CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM("общая_сумма") / COUNT(*), 0)
            ELSE 0 
        END as "средний_чек"
    FROM "Заявки"
    WHERE "статус" IN ('выполнена', 'выполнено')
    GROUP BY DATE_TRUNC('month', "дата_создания")
    ORDER BY "период" DESC
    LIMIT 6
`);

        // Get recent warehouse movements
        const warehouseMovements = await query(
            `SELECT 
               ds.id,
               t."название" as product_name,
               ds."количество",
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
        );

        const data = {
            activeOrders: parseInt(activeOrdersResult.rows[0].count) || 0,
            totalProducts: parseInt(productsResult.rows[0].count) || 0,
            activeSuppliers: parseInt(suppliersResult.rows[0].count) || 0,
            lowStockItems: parseInt(lowStockResult.rows[0].count) || 0,
            recentOrders: recentOrdersResult.rows.map(order => ({
                ...order,
                amount: parseFloat(order.amount) || 0,
                created_at: new Date(order.created_at).toISOString()
            })),
            stockByCategory: stockByCategoryResult.rows.map(item => ({
                category: item.category,
                count: parseInt(item.count) || 0
            })),
            salesByPeriod: salesByPeriod.rows,
            warehouseMovements: warehouseMovements.rows.map(item => ({
                id: item.id,
                product_name: item.product_name,
                quantity: item.quantity,
                operation_type: item.operation_type,
                operation_date: new Date(item.operation_date).toISOString(),
                comment: item.comment,
                order_id: item.order_id,
                purchase_id: item.purchase_id
            }))
        };

        res.status(200).json(data);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
}
