BEGIN;

INSERT INTO public.permissions ("key", "description")
VALUES
  ('clients.list', 'Просмотр списка клиентов'),
  ('clients.view', 'Просмотр карточки клиента'),

  ('products.list', 'Просмотр списка товаров'),
  ('products.view', 'Просмотр карточки товара'),

  ('purchases.list', 'Просмотр списка закупок'),
  ('purchases.view', 'Просмотр карточки закупки'),

  ('shipments.list', 'Просмотр списка отгрузок'),
  ('shipments.view', 'Просмотр карточки отгрузки'),

  ('suppliers.list', 'Просмотр списка поставщиков'),
  ('suppliers.view', 'Просмотр карточки поставщика'),

  ('transport.list', 'Просмотр списка ТК'),
  ('transport.view', 'Просмотр карточки ТК'),

  ('categories.list', 'Просмотр списка категорий'),
  ('categories.view', 'Просмотр карточки категории'),

  ('warehouse.list', 'Просмотр склада'),
  ('warehouse.view', 'Просмотр карточки позиции склада'),

  ('managers.list', 'Просмотр списка сотрудников'),
  ('managers.view', 'Просмотр карточки сотрудника')
ON CONFLICT ("key") DO NOTHING;

COMMIT;
