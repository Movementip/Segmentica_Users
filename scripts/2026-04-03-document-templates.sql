BEGIN;

CREATE TABLE IF NOT EXISTS public.document_templates (
    id serial PRIMARY KEY,
    key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    entity_type text,
    source_format character varying(20) NOT NULL,
    renderer_key character varying(50) NOT NULL DEFAULT 'libreoffice',
    fill_strategy_key character varying(100) NOT NULL,
    preview_mode character varying(20) NOT NULL DEFAULT 'pdf',
    pdf_postprocess_key character varying(50) NOT NULL DEFAULT 'none',
    output_formats jsonb NOT NULL DEFAULT '["excel","pdf"]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_templates_source_format_check
        CHECK (source_format IN ('xlsx', 'docx')),
    CONSTRAINT document_templates_renderer_key_check
        CHECK (renderer_key IN ('libreoffice')),
    CONSTRAINT document_templates_preview_mode_check
        CHECK (preview_mode IN ('pdf', 'html')),
    CONSTRAINT document_templates_pdf_postprocess_key_check
        CHECK (pdf_postprocess_key IN ('none', 'stack_pages_vertical'))
);

CREATE TABLE IF NOT EXISTS public.document_template_versions (
    id serial PRIMARY KEY,
    template_id integer NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version_no integer NOT NULL,
    attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
    storage_path text,
    checksum_sha256 text,
    notes text,
    is_current boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_template_versions_unique_version UNIQUE (template_id, version_no),
    CONSTRAINT document_template_versions_source_check
        CHECK (attachment_id IS NOT NULL OR NULLIF(BTRIM(COALESCE(storage_path, '')), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.generated_documents (
    id bigserial PRIMARY KEY,
    template_id integer REFERENCES public.document_templates(id) ON DELETE SET NULL,
    template_version_id integer REFERENCES public.document_template_versions(id) ON DELETE SET NULL,
    entity_type text,
    entity_id integer,
    output_format character varying(20) NOT NULL,
    filename text,
    attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    render_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT generated_documents_output_format_check
        CHECK (output_format IN ('excel', 'pdf', 'word'))
);

CREATE INDEX IF NOT EXISTS idx_document_templates_entity_type
    ON public.document_templates(entity_type);

CREATE INDEX IF NOT EXISTS idx_document_templates_is_active
    ON public.document_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_document_template_versions_template_id
    ON public.document_template_versions(template_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_template_versions_current
    ON public.document_template_versions(template_id)
    WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_generated_documents_template_id
    ON public.generated_documents(template_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_template_version_id
    ON public.generated_documents(template_version_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_entity
    ON public.generated_documents(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_created_by
    ON public.generated_documents(created_by_user_id);

WITH upsert_template AS (
    INSERT INTO public.document_templates (
        key,
        name,
        description,
        entity_type,
        source_format,
        renderer_key,
        fill_strategy_key,
        preview_mode,
        pdf_postprocess_key,
        output_formats,
        is_active
    )
    VALUES (
        'finance_statement_t49',
        'Форма Т-49 Расчетно-платежная ведомость',
        'Печатная форма расчетно-платежной ведомости по сотруднику.',
        'finance_statement',
        'xlsx',
        'libreoffice',
        'finance_statement_t49',
        'pdf',
        'stack_pages_vertical',
        '["excel","pdf"]'::jsonb,
        true
    )
    ON CONFLICT (key) DO UPDATE
    SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        entity_type = EXCLUDED.entity_type,
        source_format = EXCLUDED.source_format,
        renderer_key = EXCLUDED.renderer_key,
        fill_strategy_key = EXCLUDED.fill_strategy_key,
        preview_mode = EXCLUDED.preview_mode,
        pdf_postprocess_key = EXCLUDED.pdf_postprocess_key,
        output_formats = EXCLUDED.output_formats,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
resolved_template AS (
    SELECT id FROM upsert_template
    UNION ALL
    SELECT id FROM public.document_templates WHERE key = 'finance_statement_t49'
    LIMIT 1
)
INSERT INTO public.document_template_versions (
    template_id,
    version_no,
    storage_path,
    notes,
    is_current
)
SELECT
    id,
    1,
    'templates/forms/Форма Т-49 Расчетно-платежная ведомость.xlsx',
    'Исходный xlsx-шаблон формы Т-49 в репозитории',
    true
FROM resolved_template
ON CONFLICT (template_id, version_no) DO UPDATE
SET
    storage_path = EXCLUDED.storage_path,
    notes = EXCLUDED.notes,
    is_current = EXCLUDED.is_current;

UPDATE public.document_template_versions
SET is_current = (version_no = 1)
WHERE template_id = (
    SELECT id
    FROM public.document_templates
    WHERE key = 'finance_statement_t49'
    LIMIT 1
);

COMMIT;
