export type DataExchangeCatalogKey =
    | 'products'
    | 'categories'
    | 'clients'
    | 'suppliers'
    | 'transport'
    | 'managers'
    | 'orders'
    | 'missing_products'
    | 'purchases'
    | 'shipments'
    | 'warehouse'
    | 'warehouse_movements'
    | 'finance'
    | 'payments'
    | 'settings'
    | 'documents';

export type DataExchangeFormat = 'excel' | 'csv' | 'json';
export type DataExchangeCatalogGroup = 'reference' | 'operations' | 'system';

export type DataExchangeCatalogMeta = {
    key: DataExchangeCatalogKey;
    group: DataExchangeCatalogGroup;
    label: string;
    sheetName: string;
    fileBaseName: string;
    exportPermissions: string[];
    importPermissions: string[];
    viewPermissions: string[];
    rebuildAfterImport?: boolean;
};

export const DATA_EXCHANGE_ADMIN_PAGE_PERMISSIONS = [
    'admin.data_exchange',
    'admin.data_export.full',
    'admin.data_import.full',
];

export const DATA_EXCHANGE_CATALOGS: DataExchangeCatalogMeta[] = [
    {
        key: 'products',
        group: 'reference',
        label: 'Товары',
        sheetName: 'Товары',
        fileBaseName: 'products',
        exportPermissions: ['products.export', 'products.export.excel'],
        importPermissions: ['products.import'],
        viewPermissions: ['products.list', 'products.view'],
    },
    {
        key: 'categories',
        group: 'reference',
        label: 'Категории',
        sheetName: 'Категории',
        fileBaseName: 'categories',
        exportPermissions: ['categories.export'],
        importPermissions: ['categories.import'],
        viewPermissions: ['categories.list', 'categories.view'],
    },
    {
        key: 'clients',
        group: 'reference',
        label: 'Контрагенты',
        sheetName: 'Контрагенты',
        fileBaseName: 'clients',
        exportPermissions: ['clients.export'],
        importPermissions: ['clients.import'],
        viewPermissions: ['clients.list', 'clients.view'],
    },
    {
        key: 'suppliers',
        group: 'reference',
        label: 'Поставщики',
        sheetName: 'Поставщики',
        fileBaseName: 'suppliers',
        exportPermissions: ['suppliers.export'],
        importPermissions: ['suppliers.import'],
        viewPermissions: ['suppliers.list', 'suppliers.view'],
    },
    {
        key: 'transport',
        group: 'reference',
        label: 'Транспортные компании',
        sheetName: 'ТК',
        fileBaseName: 'transport',
        exportPermissions: ['transport.export'],
        importPermissions: ['transport.import'],
        viewPermissions: ['transport.list', 'transport.view'],
    },
    {
        key: 'managers',
        group: 'reference',
        label: 'Сотрудники',
        sheetName: 'Сотрудники',
        fileBaseName: 'managers',
        exportPermissions: ['managers.export'],
        importPermissions: ['managers.import'],
        viewPermissions: ['managers.list', 'managers.view'],
    },
    {
        key: 'orders',
        group: 'operations',
        label: 'Заявки',
        sheetName: 'Заявки',
        fileBaseName: 'orders',
        exportPermissions: ['orders.export', 'orders.export.excel'],
        importPermissions: ['orders.import'],
        viewPermissions: ['orders.list', 'orders.view'],
        rebuildAfterImport: true,
    },
    {
        key: 'missing_products',
        group: 'operations',
        label: 'Недостающие товары',
        sheetName: 'Недостающие товары',
        fileBaseName: 'missing-products',
        exportPermissions: ['missing_products.export'],
        importPermissions: ['missing_products.import'],
        viewPermissions: ['missing_products.list'],
        rebuildAfterImport: true,
    },
    {
        key: 'purchases',
        group: 'operations',
        label: 'Закупки',
        sheetName: 'Закупки',
        fileBaseName: 'purchases',
        exportPermissions: ['purchases.export', 'purchases.export.excel'],
        importPermissions: ['purchases.import'],
        viewPermissions: ['purchases.list', 'purchases.view'],
        rebuildAfterImport: true,
    },
    {
        key: 'shipments',
        group: 'operations',
        label: 'Отгрузки',
        sheetName: 'Отгрузки',
        fileBaseName: 'shipments',
        exportPermissions: ['shipments.export', 'shipments.export.excel'],
        importPermissions: ['shipments.import', 'shipments.import.excel'],
        viewPermissions: ['shipments.list', 'shipments.view'],
        rebuildAfterImport: true,
    },
    {
        key: 'warehouse',
        group: 'operations',
        label: 'Склад',
        sheetName: 'Склад',
        fileBaseName: 'warehouse',
        exportPermissions: ['warehouse.export', 'warehouse.export.excel'],
        importPermissions: ['warehouse.import', 'warehouse.import.excel'],
        viewPermissions: ['warehouse.list', 'warehouse.view'],
        rebuildAfterImport: true,
    },
    {
        key: 'warehouse_movements',
        group: 'operations',
        label: 'Движения склада',
        sheetName: 'Движения склада',
        fileBaseName: 'warehouse-movements',
        exportPermissions: ['warehouse.movements.export', 'warehouse.export', 'warehouse.movements.view'],
        importPermissions: ['warehouse.movements.import', 'warehouse.import'],
        viewPermissions: ['warehouse.movements.view'],
        rebuildAfterImport: true,
    },
    {
        key: 'finance',
        group: 'operations',
        label: 'Финансы',
        sheetName: 'Финансы',
        fileBaseName: 'finance',
        exportPermissions: ['finance.export', 'admin.finance'],
        importPermissions: ['finance.import', 'admin.finance'],
        viewPermissions: ['admin.finance'],
    },
    {
        key: 'payments',
        group: 'operations',
        label: 'Выплаты',
        sheetName: 'Выплаты',
        fileBaseName: 'payments',
        exportPermissions: ['payments.export', 'admin.finance'],
        importPermissions: ['payments.import', 'admin.finance'],
        viewPermissions: ['admin.finance'],
    },
    {
        key: 'settings',
        group: 'system',
        label: 'Настройки системы',
        sheetName: 'Настройки',
        fileBaseName: 'settings',
        exportPermissions: ['settings.export', 'admin.settings'],
        importPermissions: ['settings.import', 'admin.settings'],
        viewPermissions: ['admin.settings'],
    },
    {
        key: 'documents',
        group: 'system',
        label: 'Документы',
        sheetName: 'Документы',
        fileBaseName: 'documents',
        exportPermissions: ['documents.export', 'documents.view'],
        importPermissions: ['documents.import', 'documents.upload'],
        viewPermissions: ['documents.view'],
    },
];

export const DATA_EXCHANGE_FORMAT_OPTIONS: Array<{ value: DataExchangeFormat; label: string }> = [
    { value: 'excel', label: 'Excel' },
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
];

export const getDataExchangeCatalogMeta = (key: string): DataExchangeCatalogMeta | null => {
    return DATA_EXCHANGE_CATALOGS.find((item) => item.key === key) ?? null;
};

const hasAnyPermission = (permissions: string[] | undefined | null, candidates: string[]) => {
    const list = Array.isArray(permissions) ? permissions : [];
    return candidates.some((candidate) => list.includes(candidate));
};

export const canUseAdminDataExchangePage = (permissions: string[] | undefined | null) => {
    if (hasAnyPermission(permissions, DATA_EXCHANGE_ADMIN_PAGE_PERMISSIONS)) return true;
    return DATA_EXCHANGE_CATALOGS.some((catalog) => (
        hasAnyPermission(permissions, catalog.exportPermissions) || hasAnyPermission(permissions, catalog.importPermissions)
    ));
};

export const canExportCatalog = (permissions: string[] | undefined | null, catalogKey: DataExchangeCatalogKey) => {
    const meta = getDataExchangeCatalogMeta(catalogKey);
    if (!meta) return false;
    return hasAnyPermission(permissions, meta.exportPermissions) || hasAnyPermission(permissions, ['admin.data_export.full']);
};

export const canImportCatalog = (permissions: string[] | undefined | null, catalogKey: DataExchangeCatalogKey) => {
    const meta = getDataExchangeCatalogMeta(catalogKey);
    if (!meta) return false;
    return hasAnyPermission(permissions, meta.importPermissions) || hasAnyPermission(permissions, ['admin.data_import.full']);
};

export const isOperationalDataCatalog = (catalogKey: DataExchangeCatalogKey) => {
    const meta = getDataExchangeCatalogMeta(catalogKey);
    return Boolean(meta?.rebuildAfterImport);
};

const DATA_EXCHANGE_IMPORT_PRIORITY: DataExchangeCatalogKey[] = [
    'categories',
    'products',
    'clients',
    'suppliers',
    'transport',
    'managers',
    'orders',
    'missing_products',
    'purchases',
    'shipments',
    'warehouse_movements',
    'warehouse',
    'finance',
    'payments',
    'settings',
    'documents',
];

export const sortCatalogKeysForImport = (catalogKeys: DataExchangeCatalogKey[]) => {
    const priority = new Map<DataExchangeCatalogKey, number>(
        DATA_EXCHANGE_IMPORT_PRIORITY.map((catalogKey, index) => [catalogKey, index])
    );

    return [...catalogKeys].sort((left, right) => {
        const leftPriority = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = priority.get(right) ?? Number.MAX_SAFE_INTEGER;
        return leftPriority - rightPriority;
    });
};
