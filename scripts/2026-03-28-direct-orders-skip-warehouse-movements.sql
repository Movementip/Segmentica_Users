BEGIN;

CREATE OR REPLACE FUNCTION public.f_skip_direct_order_warehouse_movements()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    direct_order_exists BOOLEAN := false;
BEGIN
    IF NEW."заявка_id" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public."Заявки"
        WHERE id = NEW."заявка_id"
          AND COALESCE("режим_исполнения", 'warehouse') = 'direct'
    )
    INTO direct_order_exists;

    IF NOT direct_order_exists THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        RETURN NULL;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_skip_direct_order_warehouse_movements ON public."Движения_склада";

CREATE TRIGGER trg_skip_direct_order_warehouse_movements
BEFORE INSERT OR UPDATE ON public."Движения_склада"
FOR EACH ROW
EXECUTE FUNCTION public.f_skip_direct_order_warehouse_movements();

COMMIT;
