BEGIN;

ALTER TABLE IF EXISTS public."Клиенты"
    ADD COLUMN IF NOT EXISTS "краткое_название" character varying(255) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "полное_название" text COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "фамилия" character varying(120) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "имя" character varying(120) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "отчество" character varying(120) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "инн" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "кпп" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "огрн" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "огрнип" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "окпо" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "адрес_регистрации" text COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "адрес_печати" text COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "паспорт_серия" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "паспорт_номер" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "паспорт_кем_выдан" text COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "паспорт_дата_выдачи" date,
    ADD COLUMN IF NOT EXISTS "паспорт_код_подразделения" character varying(20) COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS "комментарий" text COLLATE pg_catalog."default";

CREATE TABLE IF NOT EXISTS public."Расчетные_счета_клиентов"
(
    id serial NOT NULL,
    "клиент_id" integer NOT NULL,
    "название" character varying(255) COLLATE pg_catalog."default" NOT NULL,
    "бик" character varying(20) COLLATE pg_catalog."default",
    "банк" character varying(255) COLLATE pg_catalog."default",
    "к_с" character varying(34) COLLATE pg_catalog."default",
    "р_с" character varying(34) COLLATE pg_catalog."default",
    "основной" boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Расчетные_счета_клиентов_pkey" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public."Расчетные_счета_клиентов"
    ADD CONSTRAINT "Расчетные_счета_клиентов_клиент_id_fkey" FOREIGN KEY ("клиент_id")
    REFERENCES public."Клиенты" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_расчетные_счета_клиент_id"
    ON public."Расчетные_счета_клиентов"("клиент_id");

CREATE INDEX IF NOT EXISTS "idx_клиенты_тип"
    ON public."Клиенты"("тип");

CREATE INDEX IF NOT EXISTS "idx_клиенты_инн"
    ON public."Клиенты"("инн");

CREATE INDEX IF NOT EXISTS "idx_клиенты_краткое_название"
    ON public."Клиенты"("краткое_название");

COMMIT;
