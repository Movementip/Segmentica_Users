BEGIN;

CREATE TABLE IF NOT EXISTS public."Ставки_НДС"
(
    id smallint NOT NULL,
    code character varying(50) NOT NULL,
    "название" character varying(50) NOT NULL,
    "ставка" numeric(5, 2) NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ставки_НДС_pkey" PRIMARY KEY (id),
    CONSTRAINT "Ставки_НДС_code_key" UNIQUE (code)
);

INSERT INTO public."Ставки_НДС" (id, code, "название", "ставка", sort_order, is_default, is_active)
VALUES
    (1, 'without_vat', 'без НДС', 0.00, 10, false, true),
    (2, 'vat_5', '5%', 5.00, 20, false, true),
    (3, 'vat_7', '7%', 7.00, 30, false, true),
    (4, 'vat_10', '10%', 10.00, 40, false, true),
    (5, 'vat_22', '22%', 22.00, 50, true, true)
ON CONFLICT (id) DO UPDATE
SET
    code = EXCLUDED.code,
    "название" = EXCLUDED."название",
    "ставка" = EXCLUDED."ставка",
    sort_order = EXCLUDED.sort_order,
    is_default = EXCLUDED.is_default,
    is_active = EXCLUDED.is_active;

ALTER TABLE IF EXISTS public."Позиции_заявки"
    ADD COLUMN IF NOT EXISTS "ндс_id" smallint;

ALTER TABLE IF EXISTS public."Позиции_закупки"
    ADD COLUMN IF NOT EXISTS "ндс_id" smallint;

UPDATE public."Позиции_заявки"
SET "ндс_id" = 5
WHERE "ндс_id" IS NULL;

UPDATE public."Позиции_закупки"
SET "ндс_id" = 5
WHERE "ндс_id" IS NULL;

ALTER TABLE IF EXISTS public."Позиции_заявки"
    ALTER COLUMN "ндс_id" SET DEFAULT 5;

ALTER TABLE IF EXISTS public."Позиции_закупки"
    ALTER COLUMN "ндс_id" SET DEFAULT 5;

ALTER TABLE IF EXISTS public."Позиции_заявки"
    ALTER COLUMN "ндс_id" SET NOT NULL;

ALTER TABLE IF EXISTS public."Позиции_закупки"
    ALTER COLUMN "ндс_id" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Позиции_заявки_ндс_id_fkey'
    ) THEN
        ALTER TABLE public."Позиции_заявки"
            ADD CONSTRAINT "Позиции_заявки_ндс_id_fkey"
            FOREIGN KEY ("ндс_id")
            REFERENCES public."Ставки_НДС" (id)
            ON UPDATE NO ACTION
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Позиции_закупки_ндс_id_fkey'
    ) THEN
        ALTER TABLE public."Позиции_закупки"
            ADD CONSTRAINT "Позиции_закупки_ндс_id_fkey"
            FOREIGN KEY ("ндс_id")
            REFERENCES public."Ставки_НДС" (id)
            ON UPDATE NO ACTION
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_позиции_заявки_ндс_id"
    ON public."Позиции_заявки"("ндс_id");

CREATE INDEX IF NOT EXISTS "idx_позиции_закупки_ндс_id"
    ON public."Позиции_закупки"("ндс_id");

COMMIT;
