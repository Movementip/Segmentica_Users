BEGIN;

ALTER TABLE IF EXISTS public."Закупки"
    ADD COLUMN IF NOT EXISTS "использовать_доставку" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "транспорт_id" integer,
    ADD COLUMN IF NOT EXISTS "стоимость_доставки" numeric(10, 2);

ALTER TABLE IF EXISTS public."Отгрузки"
    ADD COLUMN IF NOT EXISTS "использовать_доставку" boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public."Отгрузки"
    ADD COLUMN IF NOT EXISTS "без_учета_склада" boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public."Отгрузки"
    ALTER COLUMN "заявка_id" DROP NOT NULL;

ALTER TABLE IF EXISTS public."Отгрузки"
    ALTER COLUMN "транспорт_id" DROP NOT NULL;

ALTER TABLE IF EXISTS public."Движения_склада"
    ADD COLUMN IF NOT EXISTS "отгрузка_id" integer;

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

    INSERT INTO public."Финансы_компании" ("тип", "описание", "сумма", "заявка_id", "отгрузка_id")
    VALUES (
        'поступление',
        'Оплата заявки ' || NEW."заявка_id" || ' (отгрузка ' || NEW."id" || ')',
        order_total,
        NEW."заявка_id",
        NEW."id"
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_stock_movement_on_purchase_receipt
    ON public."Закупки";

DROP TRIGGER IF EXISTS trg_create_stock_movement_on_shipment
    ON public."Отгрузки";

DELETE FROM public."Движения_склада"
WHERE COALESCE("комментарий", '') LIKE 'Отгрузка по заявке %'
  AND "заявка_id" IS NOT NULL
  AND "закупка_id" IS NULL
  AND "отгрузка_id" IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Движения_склада_отгрузка_id_fkey'
    ) THEN
        ALTER TABLE public."Движения_склада"
            ADD CONSTRAINT "Движения_склада_отгрузка_id_fkey"
            FOREIGN KEY ("отгрузка_id")
            REFERENCES public."Отгрузки" (id)
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_закупки_транспорт_id"
    ON public."Закупки"("транспорт_id");

CREATE INDEX IF NOT EXISTS "idx_отгрузки_использовать_доставку"
    ON public."Отгрузки"("использовать_доставку");

CREATE INDEX IF NOT EXISTS "idx_движения_отгрузка_id"
    ON public."Движения_склада"("отгрузка_id");

COMMIT;
