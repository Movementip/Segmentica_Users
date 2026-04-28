CREATE SEQUENCE IF NOT EXISTS public.imported_requests_id_seq;

CREATE TABLE IF NOT EXISTS public.imported_requests (
    id bigint DEFAULT nextval('public.imported_requests_id_seq'::regclass) NOT NULL,
    source_system text DEFAULT 'bitrix'::text NOT NULL,
    source_form_id integer NOT NULL,
    source_form_name text NOT NULL,
    source_entry_id integer NOT NULL,
    source_entry_name text,
    person_name text,
    phone text,
    email text,
    product_name text,
    message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_url text,
    source_created_at timestamp(6) without time zone,
    source_updated_at timestamp(6) without time zone,
    imported_at timestamp(6) without time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp(6) without time zone DEFAULT now() NOT NULL,
    viewed_at timestamp(6) without time zone,
    processed_at timestamp(6) without time zone,
    notes text
);

ALTER SEQUENCE public.imported_requests_id_seq OWNED BY public.imported_requests.id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'imported_requests_pkey'
          AND conrelid = 'public.imported_requests'::regclass
    ) THEN
        ALTER TABLE ONLY public.imported_requests
            ADD CONSTRAINT imported_requests_pkey PRIMARY KEY (id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS imported_requests_imported_at_idx
    ON public.imported_requests USING btree (imported_at);

CREATE INDEX IF NOT EXISTS imported_requests_processed_at_idx
    ON public.imported_requests USING btree (processed_at);

CREATE INDEX IF NOT EXISTS imported_requests_viewed_at_idx
    ON public.imported_requests USING btree (viewed_at);

CREATE UNIQUE INDEX IF NOT EXISTS imported_requests_source_entry_uniq
    ON public.imported_requests USING btree (source_system, source_form_id, source_entry_id);

CREATE INDEX IF NOT EXISTS imported_requests_source_form_idx
    ON public.imported_requests USING btree (source_form_name, source_form_id);
