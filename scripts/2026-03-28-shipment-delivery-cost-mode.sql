BEGIN;

INSERT INTO public.app_settings (key, value)
VALUES ('auto_calculate_shipment_delivery_cost', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.f_calculate_delivery_cost()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    delivery_rate DECIMAL(10,2);
    order_weight INTEGER;
    auto_calculate_enabled BOOLEAN := false;
BEGIN
    SELECT COALESCE(
        NULLIF(value->>'enabled', '')::boolean,
        NULLIF(value->>'value', '')::boolean,
        false
    )
    INTO auto_calculate_enabled
    FROM public.app_settings
    WHERE key = 'auto_calculate_shipment_delivery_cost'
    LIMIT 1;

    IF COALESCE(auto_calculate_enabled, false) IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    SELECT "тариф" INTO delivery_rate
    FROM "Транспортные_компании"
    WHERE id = NEW."транспорт_id";

    SELECT SUM("количество") INTO order_weight
    FROM "Позиции_заявки"
    WHERE "заявка_id" = NEW."заявка_id";

    IF delivery_rate IS NOT NULL THEN
        NEW."стоимость_доставки" := delivery_rate * COALESCE(order_weight, 0);
    ELSE
        NEW."стоимость_доставки" := 0;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
