BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_vacations
(
    id serial NOT NULL,
    employee_id integer NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    vacation_type character varying(40) COLLATE pg_catalog."default" NOT NULL DEFAULT 'annual'::character varying,
    status character varying(40) COLLATE pg_catalog."default" NOT NULL DEFAULT 'planned'::character varying,
    comment text COLLATE pg_catalog."default",
    created_by_user_id integer,
    updated_by_user_id integer,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_vacations_pkey PRIMARY KEY (id),
    CONSTRAINT employee_vacations_dates_check CHECK (date_to >= date_from)
);

ALTER TABLE IF EXISTS public.employee_vacations
    ADD CONSTRAINT employee_vacations_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.employee_vacations
    ADD CONSTRAINT employee_vacations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.employee_vacations
    ADD CONSTRAINT employee_vacations_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_vacations_employee_id
    ON public.employee_vacations(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_vacations_date_range
    ON public.employee_vacations(employee_id, date_from, date_to);

COMMIT;
