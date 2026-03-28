BEGIN;

DO $$
DECLARE
    target_order_id INTEGER := 3;
    is_direct_order BOOLEAN := false;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public."Заявки"
        WHERE id = target_order_id
          AND COALESCE("режим_исполнения", 'warehouse') = 'direct'
    )
    INTO is_direct_order;

    IF NOT is_direct_order THEN
        RAISE EXCEPTION 'Заявка % не найдена или не имеет режима direct', target_order_id;
    END IF;

    WITH affected_movements AS (
        SELECT
            ds.id,
            ds."товар_id",
            COALESCE(ds."количество", 0)::integer AS quantity,
            COALESCE(ds."тип_операции", '') AS operation_type
        FROM public."Движения_склада" ds
        WHERE ds."заявка_id" = target_order_id
           OR ds."закупка_id" IN (
               SELECT p.id
               FROM public."Закупки" p
               WHERE p."заявка_id" = target_order_id
           )
    ),
    rollback_delta AS (
        SELECT
            "товар_id",
            SUM(
                CASE
                    WHEN operation_type = 'расход' THEN quantity
                    WHEN operation_type = 'приход' THEN -quantity
                    ELSE 0
                END
            )::integer AS delta_qty
        FROM affected_movements
        GROUP BY "товар_id"
    )
    UPDATE public."Склад" stock
    SET "количество" = GREATEST(0, COALESCE(stock."количество", 0) + rollback_delta.delta_qty),
        updated_at = CURRENT_TIMESTAMP
    FROM rollback_delta
    WHERE stock."товар_id" = rollback_delta."товар_id";

    DELETE FROM public."Движения_склада"
    WHERE "заявка_id" = target_order_id
       OR "закупка_id" IN (
           SELECT p.id
           FROM public."Закупки" p
           WHERE p."заявка_id" = target_order_id
       );
END $$;

COMMIT;
