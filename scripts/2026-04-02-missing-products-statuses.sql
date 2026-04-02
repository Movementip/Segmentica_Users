BEGIN;

ALTER TABLE IF EXISTS public."Недостающие_товары"
    DROP CONSTRAINT IF EXISTS "Недостающие_товары_статус_check";

ALTER TABLE IF EXISTS public."Недостающие_товары"
    ADD CONSTRAINT "Недостающие_товары_статус_check"
    CHECK (
        "статус" IS NULL
        OR "статус"::text = ANY (
            ARRAY[
                'в обработке'::character varying,
                'заказано'::character varying,
                'в пути'::character varying,
                'получено'::character varying,
                'не требуется'::character varying,
                'отменено'::character varying
            ]::text[]
        )
    );

COMMIT;
