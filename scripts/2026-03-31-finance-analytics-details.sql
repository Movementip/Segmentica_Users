BEGIN;

ALTER TABLE IF EXISTS public."Финансы_компании"
    ADD COLUMN IF NOT EXISTS "товар_id" integer,
    ADD COLUMN IF NOT EXISTS "счет_учета" character varying(255),
    ADD COLUMN IF NOT EXISTS "счет_затрат" character varying(255),
    ADD COLUMN IF NOT EXISTS "тип_номенклатуры" character varying(50),
    ADD COLUMN IF NOT EXISTS "источник" character varying(50) DEFAULT 'ручная_операция';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Финансы_компании_товар_id_fkey'
    ) THEN
        ALTER TABLE public."Финансы_компании"
            ADD CONSTRAINT "Финансы_компании_товар_id_fkey"
            FOREIGN KEY ("товар_id")
            REFERENCES public."Товары" (id)
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_финансы_товар_id"
    ON public."Финансы_компании"("товар_id");

CREATE INDEX IF NOT EXISTS "idx_финансы_источник"
    ON public."Финансы_компании"("источник");

CREATE INDEX IF NOT EXISTS "idx_финансы_счет_учета"
    ON public."Финансы_компании"("счет_учета");

CREATE INDEX IF NOT EXISTS "idx_финансы_счет_затрат"
    ON public."Финансы_компании"("счет_затрат");

CREATE INDEX IF NOT EXISTS "idx_финансы_тип_номенклатуры"
    ON public."Финансы_компании"("тип_номенклатуры");

UPDATE public."Финансы_компании"
SET "источник" = CASE
    WHEN "закупка_id" IS NOT NULL THEN 'закупка'
    WHEN "отгрузка_id" IS NOT NULL THEN 'отгрузка'
    WHEN "выплата_id" IS NOT NULL THEN 'выплата'
    ELSE 'ручная_операция'
END
WHERE COALESCE(TRIM("источник"), '') = ''
   OR "источник" IS NULL;

CREATE OR REPLACE FUNCTION public.f_create_finance_on_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public."Финансы_компании" ("дата", "тип", "описание", "сумма", "выплата_id", "источник")
    VALUES (
        COALESCE(NEW."дата", CURRENT_TIMESTAMP),
        'расход',
        'Выплата сотруднику ' || NEW."сотрудник_id" || ' (' || COALESCE(NEW."тип", '') || ')',
        NEW."сумма",
        NEW."id",
        'выплата'
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.f_create_finance_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."статус" = 'получено' AND (TG_OP = 'INSERT' OR OLD."статус" IS DISTINCT FROM NEW."статус") THEN
        INSERT INTO public."Финансы_компании" ("дата", "тип", "описание", "сумма", "закупка_id", "источник")
        VALUES (
            COALESCE(NEW."дата_поступления", CURRENT_TIMESTAMP),
            'расход',
            'Закупка товаров по заказу ' || NEW."id",
            COALESCE(NEW."общая_сумма", 0),
            NEW."id",
            'закупка'
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.f_create_finance_on_shipment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    order_total numeric(12, 2) := 0;
BEGIN
    IF NEW."заявка_id" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE("общая_сумма", 0)::numeric(12, 2)
    INTO order_total
    FROM public."Заявки"
    WHERE id = NEW."заявка_id"
    LIMIT 1;

    IF COALESCE(order_total, 0) <= 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO public."Финансы_компании" ("дата", "тип", "описание", "сумма", "заявка_id", "отгрузка_id", "источник")
    VALUES (
        COALESCE(NEW."дата_отгрузки", CURRENT_TIMESTAMP),
        'поступление',
        'Оплата заявки ' || NEW."заявка_id" || ' (отгрузка ' || NEW."id" || ')',
        order_total,
        NEW."заявка_id",
        NEW."id",
        'отгрузка'
    );

    RETURN NEW;
END;
$$;

COMMIT;
