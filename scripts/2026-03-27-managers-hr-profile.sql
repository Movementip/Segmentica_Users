BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_profiles
(
    employee_id integer NOT NULL,
    last_name character varying(100),
    first_name character varying(100),
    middle_name character varying(100),
    gender character varying(20),
    birth_date date,
    birth_place text,
    marital_status character varying(100),
    marital_status_since date,
    snils character varying(20),
    inn character varying(20),
    taxpayer_status character varying(120),
    citizenship_code character varying(10),
    citizenship_label character varying(120),
    registration_address text,
    registration_date date,
    actual_address_same_as_registration boolean NOT NULL DEFAULT true,
    actual_address text,
    actual_address_since date,
    personal_email character varying(150),
    work_email character varying(150),
    primary_phone character varying(30),
    work_phone character varying(30),
    education_level character varying(120),
    primary_profession character varying(255),
    secondary_profession character varying(255),
    languages text[] NOT NULL DEFAULT ARRAY[]::text[],
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_profiles_pkey PRIMARY KEY (employee_id)
);

ALTER TABLE IF EXISTS public.employee_profiles
    ADD CONSTRAINT employee_profiles_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.employee_identity_documents
(
    id serial NOT NULL,
    employee_id integer NOT NULL,
    document_type character varying(120) NOT NULL,
    series_number character varying(120),
    issued_by text,
    department_code character varying(30),
    issue_date date,
    valid_until date,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_identity_documents_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.employee_identity_documents
    ADD CONSTRAINT employee_identity_documents_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employee_identity_documents_employee_id
    ON public.employee_identity_documents(employee_id);

CREATE TABLE IF NOT EXISTS public.employee_bank_details
(
    employee_id integer NOT NULL,
    bank_name character varying(255),
    bank_bik character varying(20),
    settlement_account character varying(34),
    correspondent_account character varying(34),
    mir_card_number character varying(32),
    alternative_bank_name character varying(255),
    alternative_account_number character varying(34),
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_bank_details_pkey PRIMARY KEY (employee_id)
);

ALTER TABLE IF EXISTS public.employee_bank_details
    ADD CONSTRAINT employee_bank_details_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.employee_employment_details
(
    employee_id integer NOT NULL,
    position_category character varying(120),
    department_name character varying(255),
    subdivision_name character varying(255),
    is_flight_crew boolean NOT NULL DEFAULT false,
    is_sea_crew boolean NOT NULL DEFAULT false,
    contract_type character varying(80),
    labor_book_status character varying(120),
    labor_book_notes text,
    foreign_work_permit_note text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_employment_details_pkey PRIMARY KEY (employee_id)
);

ALTER TABLE IF EXISTS public.employee_employment_details
    ADD CONSTRAINT employee_employment_details_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.employee_employment_events
(
    id serial NOT NULL,
    employee_id integer NOT NULL,
    event_date date,
    event_type character varying(120) NOT NULL,
    details text,
    status character varying(80),
    sent_date date,
    external_uuid uuid DEFAULT gen_random_uuid(),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_employment_events_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.employee_employment_events
    ADD CONSTRAINT employee_employment_events_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employee_employment_events_employee_id
    ON public.employee_employment_events(employee_id);

CREATE TABLE IF NOT EXISTS public.employee_relatives
(
    id serial NOT NULL,
    employee_id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    relation_type character varying(120),
    birth_date date,
    document_info text,
    snils character varying(20),
    phone character varying(30),
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_relatives_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.employee_relatives
    ADD CONSTRAINT employee_relatives_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employee_relatives_employee_id
    ON public.employee_relatives(employee_id);

CREATE TABLE IF NOT EXISTS public.employee_military_records
(
    employee_id integer NOT NULL,
    relation_to_service character varying(120),
    reserve_category character varying(80),
    military_rank character varying(120),
    unit_composition character varying(120),
    specialty_code character varying(80),
    fitness_category character varying(80),
    fitness_checked_at date,
    commissariat_name character varying(255),
    commissariat_manual character varying(255),
    additional_info text,
    military_registration_type character varying(120),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_military_records_pkey PRIMARY KEY (employee_id)
);

ALTER TABLE IF EXISTS public.employee_military_records
    ADD CONSTRAINT employee_military_records_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.employee_military_documents
(
    id serial NOT NULL,
    employee_id integer NOT NULL,
    document_type character varying(120) NOT NULL,
    series_number character varying(120),
    issued_by text,
    issue_date date,
    valid_until date,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_military_documents_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.employee_military_documents
    ADD CONSTRAINT employee_military_documents_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public."Сотрудники" (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employee_military_documents_employee_id
    ON public.employee_military_documents(employee_id);

COMMIT;
