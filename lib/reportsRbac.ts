export const REPORT_TAB_PERMISSIONS = {
    overview: 'reports.overview.view',
    sales: 'reports.sales.view',
    products: 'reports.products.view',
    clients: 'reports.clients.view',
    logistics: 'reports.logistics.view',
    custom: 'reports.custom.view',
} as const;

export const REPORT_VIEW_PERMISSIONS: Record<string, string> = {
    анализ_клиентов: 'reports.custom.clients_analysis.view',
    анализ_недостач: 'reports.custom.missing_analysis.view',
    анализ_поставщиков: 'reports.custom.suppliers_analysis.view',
    движения_склада_детализированные: 'reports.custom.warehouse_movements.view',
    продажи_по_периодам: 'reports.custom.sales_by_period.view',
    статистика_транспортных_компаний: 'reports.custom.transport_stats.view',
    финансовый_обзор: 'reports.custom.finance_overview.view',
    эффективность_сотрудников: 'reports.custom.employee_performance.view',
};

export const REPORT_EXPORT_WORD_PERMISSIONS: Record<string, string> = {
    анализ_клиентов: 'reports.custom.clients_analysis.export.word',
    анализ_недостач: 'reports.custom.missing_analysis.export.word',
    анализ_поставщиков: 'reports.custom.suppliers_analysis.export.word',
    движения_склада_детализированные: 'reports.custom.warehouse_movements.export.word',
    продажи_по_периодам: 'reports.custom.sales_by_period.export.word',
    статистика_транспортных_компаний: 'reports.custom.transport_stats.export.word',
    финансовый_обзор: 'reports.custom.finance_overview.export.word',
    эффективность_сотрудников: 'reports.custom.employee_performance.export.word',
};

export const REPORT_EXPORT_EXCEL_PERMISSIONS: Record<string, string> = {
    анализ_клиентов: 'reports.custom.clients_analysis.export.excel',
    анализ_недостач: 'reports.custom.missing_analysis.export.excel',
    анализ_поставщиков: 'reports.custom.suppliers_analysis.export.excel',
    движения_склада_детализированные: 'reports.custom.warehouse_movements.export.excel',
    продажи_по_периодам: 'reports.custom.sales_by_period.export.excel',
    статистика_транспортных_компаний: 'reports.custom.transport_stats.export.excel',
    финансовый_обзор: 'reports.custom.finance_overview.export.excel',
    эффективность_сотрудников: 'reports.custom.employee_performance.export.excel',
};

export const REPORT_ALLOWED_VIEWS = Object.keys(REPORT_VIEW_PERMISSIONS);
