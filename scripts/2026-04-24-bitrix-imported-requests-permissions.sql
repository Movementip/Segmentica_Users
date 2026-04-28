WITH src_permissions(key, name, description) AS (
  VALUES
    ('orders.bitrix_requests.list', 'Просмотр заявок с Битрикс24', 'Действие'),
    ('orders.bitrix_requests.process', 'Обработка заявок с Битрикс24', 'Действие'),
    ('archive.bitrix_requests.list', 'Просмотр архивных заявок Битрикс24', 'Действие')
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
    ('director', 'orders.bitrix_requests.list'),
    ('director', 'orders.bitrix_requests.process'),
    ('director', 'archive.bitrix_requests.list'),
    ('manager', 'orders.bitrix_requests.list'),
    ('manager', 'orders.bitrix_requests.process'),
    ('manager', 'archive.bitrix_requests.list')
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
