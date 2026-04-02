BEGIN;

WITH src_permissions(key, name, description) AS (
  VALUES
    ('suppliers.assortment.manage', 'Управление ассортиментом поставщика', 'Действие'),
    ('admin.settings.supplier_assortment.manage', 'Управление настройкой "Учитывать ассортимент поставщиков"', 'Специальное право'),
    ('admin.settings.supplier_lead_time.manage', 'Управление настройкой "Учитывать время поставки"', 'Специальное право')
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
    ('director', 'suppliers.assortment.manage'),
    ('director', 'admin.settings.supplier_assortment.manage'),
    ('director', 'admin.settings.supplier_lead_time.manage'),
    ('purchaser', 'suppliers.assortment.manage')
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
