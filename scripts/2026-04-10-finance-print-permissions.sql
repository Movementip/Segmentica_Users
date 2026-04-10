BEGIN;

WITH src_permissions(key, name, description) AS (
  VALUES
    ('finance.print', 'Печать печатных форм финансов', 'Действие'),
    ('finance.export.pdf', 'Экспорт печатных форм финансов в PDF', 'Действие'),
    ('finance.export.excel', 'Экспорт печатных форм финансов в Excel', 'Действие')
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
    ('director', 'finance.print'),
    ('director', 'finance.export.pdf'),
    ('director', 'finance.export.excel'),
    ('accountant', 'finance.print'),
    ('accountant', 'finance.export.pdf'),
    ('accountant', 'finance.export.excel')
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
