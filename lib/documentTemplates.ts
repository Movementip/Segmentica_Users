import path from 'path';
import { query } from './db';

export type DocumentTemplateKey = 'finance_statement_t49';

export type DocumentTemplateSourceFormat = 'xlsx' | 'docx';
export type DocumentTemplateRendererKey = 'libreoffice';
export type DocumentTemplatePreviewMode = 'pdf' | 'html';
export type DocumentTemplatePostprocess = 'none' | 'stack_pages_vertical';
export type DocumentTemplateFillStrategyKey = 'finance_statement_t49';

export type DocumentTemplateDefinition = {
    key: DocumentTemplateKey;
    name: string;
    description: string | null;
    sourceFormat: DocumentTemplateSourceFormat;
    rendererKey: DocumentTemplateRendererKey;
    fillStrategyKey: DocumentTemplateFillStrategyKey;
    previewMode: DocumentTemplatePreviewMode;
    pdfPostprocess: DocumentTemplatePostprocess;
    outputFormats: Array<'excel' | 'pdf'>;
    templateName: string;
    templatePath: string;
    versionNo: number | null;
    isActive: boolean;
};

type DocumentTemplateRow = {
    key: string;
    name: string;
    description: string | null;
    source_format: string;
    renderer_key: string;
    fill_strategy_key: string;
    preview_mode: string;
    pdf_postprocess_key: string;
    output_formats: unknown;
    is_active: boolean;
    version_no: number | null;
    storage_path: string | null;
};

const TEMPLATE_DIR = path.join(process.cwd(), 'templates', 'forms');

const STATIC_TEMPLATES: Record<DocumentTemplateKey, DocumentTemplateDefinition> = {
    finance_statement_t49: {
        key: 'finance_statement_t49',
        name: 'Форма Т-49 Расчетно-платежная ведомость',
        description: 'Печатная форма расчетно-платежной ведомости по сотруднику.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'finance_statement_t49',
        previewMode: 'pdf',
        pdfPostprocess: 'stack_pages_vertical',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма Т-49 Расчетно-платежная ведомость.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма Т-49 Расчетно-платежная ведомость.xlsx'),
        versionNo: 1,
        isActive: true,
    },
};

const normalizeOutputFormats = (value: unknown): Array<'excel' | 'pdf'> => {
    if (!Array.isArray(value)) return ['excel', 'pdf'];
    const formats = value
        .map((item) => String(item || '').trim().toLowerCase())
        .filter((item): item is 'excel' | 'pdf' => item === 'excel' || item === 'pdf');

    return formats.length ? formats : ['excel', 'pdf'];
};

const normalizeSourceFormat = (value: unknown, fallback: DocumentTemplateSourceFormat): DocumentTemplateSourceFormat => {
    const format = String(value || '').trim().toLowerCase();
    if (format === 'xlsx' || format === 'docx') return format;
    return fallback;
};

const normalizeRendererKey = (value: unknown, fallback: DocumentTemplateRendererKey): DocumentTemplateRendererKey => {
    const renderer = String(value || '').trim().toLowerCase();
    if (renderer === 'libreoffice') return 'libreoffice';
    return fallback;
};

const normalizePreviewMode = (value: unknown, fallback: DocumentTemplatePreviewMode): DocumentTemplatePreviewMode => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'pdf' || mode === 'html') return mode;
    return fallback;
};

const normalizePostprocess = (value: unknown, fallback: DocumentTemplatePostprocess): DocumentTemplatePostprocess => {
    const postprocess = String(value || '').trim().toLowerCase();
    if (postprocess === 'none' || postprocess === 'stack_pages_vertical') return postprocess;
    return fallback;
};

const normalizeFillStrategyKey = (
    value: unknown,
    fallback: DocumentTemplateFillStrategyKey
): DocumentTemplateFillStrategyKey => {
    const strategy = String(value || '').trim().toLowerCase();
    if (strategy === 'finance_statement_t49') return 'finance_statement_t49';
    return fallback;
};

const isMissingDocumentTemplatesTableError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes('document_templates') || message.includes('document_template_versions');
};

const resolveDbTemplate = async (templateKey: DocumentTemplateKey): Promise<DocumentTemplateDefinition | null> => {
    try {
        const res = await query(
            `
            SELECT
                t.key,
                t.name,
                t.description,
                t.source_format,
                t.renderer_key,
                t.fill_strategy_key,
                t.preview_mode,
                t.pdf_postprocess_key,
                t.output_formats,
                t.is_active,
                v.version_no,
                v.storage_path
            FROM public.document_templates t
            LEFT JOIN public.document_template_versions v
              ON v.template_id = t.id
             AND v.is_current = true
            WHERE t.key = $1
            LIMIT 1
            `,
            [templateKey]
        );

        const row = res.rows?.[0] as DocumentTemplateRow | undefined;
        if (!row) return null;

        const staticTemplate = STATIC_TEMPLATES[templateKey];
        const storagePath = String(row.storage_path || '').trim();
        const resolvedPath = storagePath
            ? (path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath))
            : staticTemplate.templatePath;

        return {
            key: templateKey,
            name: String(row.name || staticTemplate.name),
            description: row.description == null ? staticTemplate.description : String(row.description),
            sourceFormat: normalizeSourceFormat(row.source_format, staticTemplate.sourceFormat),
            rendererKey: normalizeRendererKey(row.renderer_key, staticTemplate.rendererKey),
            fillStrategyKey: normalizeFillStrategyKey(row.fill_strategy_key, staticTemplate.fillStrategyKey),
            previewMode: normalizePreviewMode(row.preview_mode, staticTemplate.previewMode),
            pdfPostprocess: normalizePostprocess(row.pdf_postprocess_key, staticTemplate.pdfPostprocess),
            outputFormats: normalizeOutputFormats(row.output_formats),
            templateName: path.basename(resolvedPath),
            templatePath: resolvedPath,
            versionNo: row.version_no == null ? null : Number(row.version_no),
            isActive: Boolean(row.is_active),
        };
    } catch (error) {
        if (isMissingDocumentTemplatesTableError(error)) {
            return null;
        }
        throw error;
    }
};

export const getDocumentTemplateDefinition = async (
    templateKey: DocumentTemplateKey
): Promise<DocumentTemplateDefinition> => {
    const fromDb = await resolveDbTemplate(templateKey);
    return fromDb || STATIC_TEMPLATES[templateKey];
};
