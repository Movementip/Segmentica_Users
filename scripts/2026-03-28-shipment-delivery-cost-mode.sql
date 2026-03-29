BEGIN;

INSERT INTO public.app_settings (key, value)
VALUES ('auto_calculate_shipment_delivery_cost', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_calculate_delivery_cost
ON public."Отгрузки";

DROP FUNCTION IF EXISTS public.f_calculate_delivery_cost();

COMMIT;
