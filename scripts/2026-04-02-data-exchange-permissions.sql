BEGIN;

WITH src_permissions(key, name, description) AS (
  VALUES
    ('products.export', 'Экспорт товаров', 'Действие'),
    ('categories.export', 'Экспорт категорий', 'Действие'),
    ('categories.import', 'Импорт категорий', 'Действие'),
    ('clients.export', 'Экспорт контрагентов', 'Действие'),
    ('clients.import', 'Импорт контрагентов', 'Действие'),
    ('suppliers.export', 'Экспорт поставщиков', 'Действие'),
    ('suppliers.import', 'Импорт поставщиков', 'Действие'),
    ('transport.export', 'Экспорт транспортных компаний', 'Действие'),
    ('transport.import', 'Импорт транспортных компаний', 'Действие'),
    ('managers.export', 'Экспорт сотрудников', 'Действие'),
    ('managers.import', 'Импорт сотрудников', 'Действие'),
    ('orders.export', 'Экспорт заявок', 'Действие'),
    ('orders.import', 'Импорт заявок', 'Действие'),
    ('missing_products.export', 'Экспорт недостающих товаров', 'Действие'),
    ('missing_products.import', 'Импорт недостающих товаров', 'Действие'),
    ('purchases.export', 'Экспорт закупок', 'Действие'),
    ('purchases.import', 'Импорт закупок', 'Действие'),
    ('shipments.export', 'Экспорт отгрузок', 'Действие'),
    ('shipments.import', 'Импорт отгрузок', 'Действие'),
    ('warehouse.export', 'Экспорт склада', 'Действие'),
    ('warehouse.import', 'Импорт склада', 'Действие'),
    ('warehouse.movements.export', 'Экспорт движений склада', 'Действие'),
    ('warehouse.movements.import', 'Импорт движений склада', 'Действие'),
    ('finance.export', 'Экспорт финансовых операций', 'Действие'),
    ('finance.import', 'Импорт финансовых операций', 'Действие'),
    ('payments.export', 'Экспорт выплат', 'Действие'),
    ('payments.import', 'Импорт выплат', 'Действие'),
    ('settings.export', 'Экспорт системных настроек', 'Действие'),
    ('settings.import', 'Импорт системных настроек', 'Действие'),
    ('documents.export', 'Экспорт документов', 'Действие'),
    ('documents.import', 'Импорт документов', 'Действие'),
    ('admin.data_exchange', 'Доступ к странице "Обмен данными"', 'Специальное право'),
    ('admin.data_export.full', 'Массовый экспорт данных', 'Специальное право'),
    ('admin.data_import.full', 'Массовый импорт данных', 'Специальное право')
)
INSERT INTO public.permissions(key, name, description)
SELECT key, name, description
FROM src_permissions
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

WITH src_role_perms(role_key, perm_key) AS (
  VALUES
    ('director', 'products.export'),
    ('director', 'categories.export'),
    ('director', 'categories.import'),
    ('director', 'clients.export'),
    ('director', 'clients.import'),
    ('director', 'suppliers.export'),
    ('director', 'suppliers.import'),
    ('director', 'transport.export'),
    ('director', 'transport.import'),
    ('director', 'managers.export'),
    ('director', 'managers.import'),
    ('director', 'orders.export'),
    ('director', 'orders.import'),
    ('director', 'missing_products.export'),
    ('director', 'missing_products.import'),
    ('director', 'purchases.export'),
    ('director', 'purchases.import'),
    ('director', 'shipments.export'),
    ('director', 'shipments.import'),
    ('director', 'warehouse.export'),
    ('director', 'warehouse.import'),
    ('director', 'warehouse.movements.export'),
    ('director', 'warehouse.movements.import'),
    ('director', 'finance.export'),
    ('director', 'finance.import'),
    ('director', 'payments.export'),
    ('director', 'payments.import'),
    ('director', 'settings.export'),
    ('director', 'settings.import'),
    ('director', 'documents.export'),
    ('director', 'documents.import'),
    ('director', 'admin.data_exchange'),
    ('director', 'admin.data_export.full'),
    ('director', 'admin.data_import.full'),
    ('manager', 'clients.export'),
    ('manager', 'clients.import'),
    ('manager', 'orders.export'),
    ('manager', 'orders.import'),
    ('purchaser', 'suppliers.export'),
    ('purchaser', 'suppliers.import'),
    ('purchaser', 'purchases.export'),
    ('purchaser', 'purchases.import'),
    ('purchaser', 'missing_products.export'),
    ('purchaser', 'missing_products.import'),
    ('logistics', 'transport.export'),
    ('logistics', 'transport.import'),
    ('logistics', 'shipments.export'),
    ('logistics', 'shipments.import'),
    ('warehouse_manager', 'warehouse.export'),
    ('warehouse_manager', 'warehouse.import'),
    ('warehouse_manager', 'warehouse.movements.export'),
    ('warehouse_manager', 'warehouse.movements.import'),
    ('warehouse_manager', 'missing_products.export'),
    ('warehouse_manager', 'missing_products.import'),
    ('accountant', 'finance.export'),
    ('accountant', 'finance.import'),
    ('accountant', 'payments.export'),
    ('accountant', 'payments.import')
),
resolved AS (
  SELECT
    r.id AS role_id,
    p.id AS permission_id
  FROM src_role_perms s
  JOIN public.roles r ON r.key = s.role_key
  JOIN public.permissions p ON p.key = s.perm_key
)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT role_id, permission_id
FROM resolved
ON CONFLICT DO NOTHING;

COMMIT;
