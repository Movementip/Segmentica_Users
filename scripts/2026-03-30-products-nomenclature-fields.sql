BEGIN;

ALTER TABLE IF EXISTS public."Товары"
    ADD COLUMN IF NOT EXISTS "тип_номенклатуры" character varying(50),
    ADD COLUMN IF NOT EXISTS "счет_учета" character varying(50),
    ADD COLUMN IF NOT EXISTS "счет_затрат" character varying(50),
    ADD COLUMN IF NOT EXISTS "ндс_id" smallint,
    ADD COLUMN IF NOT EXISTS "комментарий" text;

UPDATE public."Товары"
SET "тип_номенклатуры" = 'товар'
WHERE "тип_номенклатуры" IS NULL;

UPDATE public."Товары"
SET "ндс_id" = 5
WHERE "ндс_id" IS NULL;

ALTER TABLE IF EXISTS public."Товары"
    ALTER COLUMN "тип_номенклатуры" SET DEFAULT 'товар';

ALTER TABLE IF EXISTS public."Товары"
    ALTER COLUMN "тип_номенклатуры" SET NOT NULL;

ALTER TABLE IF EXISTS public."Товары"
    ALTER COLUMN "ндс_id" SET DEFAULT 5;

ALTER TABLE IF EXISTS public."Товары"
    ALTER COLUMN "ндс_id" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Товары_ндс_id_fkey'
    ) THEN
        ALTER TABLE public."Товары"
            ADD CONSTRAINT "Товары_ндс_id_fkey"
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
        WHERE conname = 'Товары_тип_номенклатуры_check'
    ) THEN
        ALTER TABLE public."Товары"
            ADD CONSTRAINT "Товары_тип_номенклатуры_check"
            CHECK (
                "тип_номенклатуры" IN (
                    'товар',
                    'материал',
                    'продукция',
                    'входящая_услуга',
                    'исходящая_услуга',
                    'внеоборотный_актив'
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_товары_ндс_id"
    ON public."Товары"("ндс_id");

COMMIT;
