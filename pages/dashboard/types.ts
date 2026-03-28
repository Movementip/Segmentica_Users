export interface DashboardStats {
    activeOrders: number;
    totalProducts: number;
    activeSuppliers: number;
    lowStockItems: number;
    monthlyRevenue: number;
    pendingShipments: number;
    recentOrders: Array<{
        id: number;
        client: string;
        amount: number;
        status: string;
        created_at: string;
    }>;
    stockByCategory: Array<{
        category: string;
        count: number;
    }>;
    warehouseMovements: Array<{
        id: number;
        product_name: string;
        quantity: number;
        operation_type: string;
        operation_date: string;
        comment: string;
        order_id: string;
        purchase_id: string;
    }>;
    salesByPeriod: Array<{
        период: string;
        количество_продаж: number;
        общая_сумма: number;
        средний_чек: number;
    }>;
}
