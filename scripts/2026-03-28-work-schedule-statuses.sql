BEGIN;

ALTER TABLE public."График_работы"
    DROP CONSTRAINT IF EXISTS "График_работы_статус_check";

ALTER TABLE public."График_работы"
    ADD CONSTRAINT "График_работы_статус_check"
    CHECK (
        ("статус")::text = ANY (
            ARRAY[
                ('Работал'::character varying)::text,
                ('отпуск'::character varying)::text,
                ('больничный'::character varying)::text,
                ('командировка'::character varying)::text,
                ('работа на выезде'::character varying)::text
            ]
        )
    );

COMMIT;
