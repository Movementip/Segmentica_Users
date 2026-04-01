BEGIN;

ALTER TABLE IF EXISTS public."Поставщики"
    ADD COLUMN IF NOT EXISTS "тип" character varying(120) COLLATE pg_catalog."default",
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

CREATE TABLE IF NOT EXISTS public."Расчетные_счета_поставщиков"
(
    id serial NOT NULL,
    "поставщик_id" integer NOT NULL,
    "название" character varying(255) COLLATE pg_catalog."default" NOT NULL,
    "бик" character varying(20) COLLATE pg_catalog."default",
    "банк" character varying(255) COLLATE pg_catalog."default",
    "к_с" character varying(34) COLLATE pg_catalog."default",
    "р_с" character varying(34) COLLATE pg_catalog."default",
    "основной" boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Расчетные_счета_поставщиков_pkey" PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public."Расчетные_счета_поставщиков"
    ADD CONSTRAINT "Расчетные_счета_поставщиков_поставщик_id_fkey" FOREIGN KEY ("поставщик_id")
    REFERENCES public."Поставщики" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_расчетные_счета_поставщик_id"
    ON public."Расчетные_счета_поставщиков"("поставщик_id");

CREATE INDEX IF NOT EXISTS "idx_поставщики_тип"
    ON public."Поставщики"("тип");

CREATE INDEX IF NOT EXISTS "idx_поставщики_инн"
    ON public."Поставщики"("инн");

CREATE INDEX IF NOT EXISTS "idx_поставщики_краткое_название"
    ON public."Поставщики"("краткое_название");

COMMIT;
