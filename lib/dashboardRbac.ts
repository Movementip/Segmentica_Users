import { REPORT_TAB_PERMISSIONS } from './reportsRbac';

export const DASHBOARD_PAGE_PERMISSION = 'dashboard.view';

export const DASHBOARD_SECTION_PERMISSIONS = {
    quickActions: 'dashboard.quick_actions.view',
    summaryStats: 'dashboard.summary.view',
    salesChart: 'dashboard.sales_chart.view',
    stockByCategory: 'dashboard.stock_by_category.view',
    recentOrders: 'dashboard.recent_orders.view',
    warehouseMovements: 'dashboard.warehouse_movements.view',
    financeChart: 'dashboard.finance_chart.view',
    topProducts: 'dashboard.top_products.view',
    topClients: 'dashboard.top_clients.view',
    transportPerformance: 'dashboard.transport_performance.view',
} as const;

type DashboardPermissions = string[] | null | undefined;

const hasPermission = (permissions: DashboardPermissions, key: string): boolean => {
    if (!Array.isArray(permissions)) return false;
    return permissions.includes(key);
};

const hasAnyPermission = (permissions: DashboardPermissions, keys: string[]): boolean => {
    return keys.some((key) => hasPermission(permissions, key));
};

export type DashboardAccess = {
    canDashboardPage: boolean;
    canDashboard: boolean;
    canQuickActions: boolean;
    canSummaryStats: boolean;
    canSalesChart: boolean;
    canStockByCategory: boolean;
    canRecentOrders: boolean;
    canWarehouseMovements: boolean;
    canFinanceChart: boolean;
    canTopProducts: boolean;
    canTopClients: boolean;
    canTransportPerformance: boolean;
    canDashboardDataApi: boolean;
    quickActions: {
        products: boolean;
        suppliers: boolean;
        orders: boolean;
        purchases: boolean;
        reports: boolean;
    };
    statsCards: {
        activeOrders: boolean;
        totalProducts: boolean;
        activeSuppliers: boolean;
        lowStockItems: boolean;
    };
};

export const getDashboardAccess = (permissions: DashboardPermissions): DashboardAccess => {
    const canPage = hasPermission(permissions, DASHBOARD_PAGE_PERMISSION);

    const canQuickActionsBlock = hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.quickActions);
    const canSummaryBlock = hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.summaryStats);

    const quickActions = {
        products: canQuickActionsBlock && hasPermission(permissions, 'products.list'),
        suppliers: canQuickActionsBlock && hasPermission(permissions, 'suppliers.list'),
        orders: canQuickActionsBlock && hasPermission(permissions, 'orders.list'),
        purchases: canQuickActionsBlock && hasPermission(permissions, 'purchases.list'),
        reports: canQuickActionsBlock && hasAnyPermission(permissions, Object.values(REPORT_TAB_PERMISSIONS)),
    };

    const statsCards = {
        activeOrders: canSummaryBlock && hasPermission(permissions, 'orders.list'),
        totalProducts: canSummaryBlock && hasAnyPermission(permissions, ['warehouse.list', 'products.list']),
        activeSuppliers: canSummaryBlock && hasPermission(permissions, 'suppliers.list'),
        lowStockItems: canSummaryBlock && hasPermission(permissions, 'warehouse.critical.view'),
    };

    const canQuickActions = Object.values(quickActions).some(Boolean);
    const canSummaryStats = Object.values(statsCards).some(Boolean);
    const canSalesChart = hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.salesChart);
    const canStockByCategory =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.stockByCategory) &&
        hasAnyPermission(permissions, ['warehouse.list', 'products.list']);
    const canRecentOrders =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.recentOrders) &&
        hasPermission(permissions, 'orders.list');
    const canWarehouseMovements =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.warehouseMovements) &&
        hasPermission(permissions, 'warehouse.movements.view');
    const canFinanceChart =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.financeChart) &&
        hasPermission(permissions, REPORT_TAB_PERMISSIONS.overview);
    const canTopProducts =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.topProducts) &&
        hasPermission(permissions, REPORT_TAB_PERMISSIONS.products);
    const canTopClients =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.topClients) &&
        hasPermission(permissions, REPORT_TAB_PERMISSIONS.clients);
    const canTransportPerformance =
        hasPermission(permissions, DASHBOARD_SECTION_PERMISSIONS.transportPerformance) &&
        hasPermission(permissions, REPORT_TAB_PERMISSIONS.logistics);

    const canDashboardContent = Boolean(
        canQuickActions ||
        canSummaryStats ||
        canSalesChart ||
        canStockByCategory ||
        canRecentOrders ||
        canWarehouseMovements ||
        canFinanceChart ||
        canTopProducts ||
        canTopClients ||
        canTransportPerformance
    );

    return {
        canDashboardPage: canPage,
        canDashboard: canPage && canDashboardContent,
        canQuickActions,
        canSummaryStats,
        canSalesChart,
        canStockByCategory,
        canRecentOrders,
        canWarehouseMovements,
        canFinanceChart,
        canTopProducts,
        canTopClients,
        canTransportPerformance,
        canDashboardDataApi: canSummaryStats || canSalesChart || canStockByCategory || canRecentOrders || canWarehouseMovements,
        quickActions,
        statsCards,
    };
};
