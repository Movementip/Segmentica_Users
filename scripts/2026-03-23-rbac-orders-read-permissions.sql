BEGIN;

INSERT INTO public.permissions ("key", "description")
VALUES
  ('orders.list', 'Просмотр списка заявок'),
  ('orders.view', 'Просмотр карточки заявки')
ON CONFLICT ("key") DO NOTHING;

COMMIT;
