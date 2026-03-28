BEGIN;

-- Add granular attachment permissions per entity_type so director can grant via roles or user_permissions.
-- We use <module>.attachments.<action> naming.

INSERT INTO public.permissions ("key", "description")
VALUES
  ('orders.attachments.view', 'Просмотр вложений заявок'),
  ('orders.attachments.upload', 'Загрузка вложений заявок'),
  ('orders.attachments.delete', 'Удаление вложений заявок'),

  ('products.attachments.view', 'Просмотр вложений товаров'),
  ('products.attachments.upload', 'Загрузка вложений товаров'),
  ('products.attachments.delete', 'Удаление вложений товаров'),

  ('clients.attachments.view', 'Просмотр вложений клиентов'),
  ('clients.attachments.upload', 'Загрузка вложений клиентов'),
  ('clients.attachments.delete', 'Удаление вложений клиентов'),

  ('purchases.attachments.view', 'Просмотр вложений закупок'),
  ('purchases.attachments.upload', 'Загрузка вложений закупок'),
  ('purchases.attachments.delete', 'Удаление вложений закупок'),

  ('shipments.attachments.view', 'Просмотр вложений отгрузок'),
  ('shipments.attachments.upload', 'Загрузка вложений отгрузок'),
  ('shipments.attachments.delete', 'Удаление вложений отгрузок'),

  ('suppliers.attachments.view', 'Просмотр вложений поставщиков'),
  ('suppliers.attachments.upload', 'Загрузка вложений поставщиков'),
  ('suppliers.attachments.delete', 'Удаление вложений поставщиков'),

  ('transport.attachments.view', 'Просмотр вложений транспорта'),
  ('transport.attachments.upload', 'Загрузка вложений транспорта'),
  ('transport.attachments.delete', 'Удаление вложений транспорта'),

  ('managers.attachments.view', 'Просмотр вложений сотрудников'),
  ('managers.attachments.upload', 'Загрузка вложений сотрудников'),
  ('managers.attachments.delete', 'Удаление вложений сотрудников')
ON CONFLICT ("key") DO NOTHING;

COMMIT;
