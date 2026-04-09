import { promises as fs } from 'fs';
import path from 'path';
import { query } from './db';

export type DocumentTemplateKey =
    | 'finance_statement_t49'
    | 'finance_payslip'
    | 'finance_timesheet_t13'
    | 'order_invoice'
    | 'order_invoice_alt'
    | 'order_supply_contract'
    | 'order_supply_specification'
    | 'order_service_contract'
    | 'order_work_contract'
    | 'order_outgoing_act'
    | 'purchase_upd_status_1'
    | 'purchase_upd_status_2'
    | 'purchase_torg_12'
    | 'shipment_upd_status_1'
    | 'shipment_upd_status_2'
    | 'shipment_torg_12'
    | 'shipment_transport_waybill';

export type DocumentTemplateSourceFormat = 'xls' | 'xlsx' | 'doc' | 'docx';
export type DocumentTemplateRendererKey = 'libreoffice';
export type DocumentTemplatePreviewMode = 'pdf' | 'html';
export type DocumentTemplatePostprocess = 'none' | 'stack_pages_vertical';
export type DocumentTemplateFillStrategyKey =
    | 'finance_statement_t49'
    | 'finance_payslip'
    | 'finance_timesheet_t13'
    | 'order_invoice'
    | 'order_invoice_alt'
    | 'order_supply_contract'
    | 'order_supply_specification'
    | 'order_service_contract'
    | 'order_work_contract'
    | 'order_outgoing_act'
    | 'purchase_upd_status_1'
    | 'purchase_upd_status_2'
    | 'purchase_torg_12'
    | 'shipment_upd_status_1'
    | 'shipment_upd_status_2'
    | 'shipment_torg_12'
    | 'shipment_transport_waybill';

export type DocumentTemplateDefinition = {
    key: DocumentTemplateKey;
    name: string;
    description: string | null;
    sourceFormat: DocumentTemplateSourceFormat;
    rendererKey: DocumentTemplateRendererKey;
    fillStrategyKey: DocumentTemplateFillStrategyKey;
    previewMode: DocumentTemplatePreviewMode;
    pdfPostprocess: DocumentTemplatePostprocess;
    outputFormats: Array<'excel' | 'pdf' | 'word'>;
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

const normalizeTemplateFilename = (value: string): string =>
    String(value || '').normalize('NFC').toLocaleLowerCase('ru-RU');

const resolveExistingTemplatePath = async (templatePath: string): Promise<string> => {
    const directory = path.dirname(templatePath);
    const requestedName = path.basename(templatePath);

    try {
        const entries = await fs.readdir(directory);
        const matchedName = entries.find((entry) => normalizeTemplateFilename(entry) === normalizeTemplateFilename(requestedName));
        if (matchedName) {
            return path.join(directory, matchedName);
        }
    } catch {
        return templatePath;
    }

    return templatePath;
};

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
    finance_payslip: {
        key: 'finance_payslip',
        name: 'Расчетный лист',
        description: 'Индивидуальный расчетный листок сотрудника за выбранный месяц.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'finance_payslip',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма_ Расчетный листок работника организации.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма_ Расчетный листок работника организации.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    finance_timesheet_t13: {
        key: 'finance_timesheet_t13',
        name: 'Форма Т-13 Табель учета рабочего времени',
        description: 'Печатная форма табеля учета рабочего времени за выбранный месяц.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'finance_timesheet_t13',
        previewMode: 'pdf',
        pdfPostprocess: 'stack_pages_vertical',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма Т-13 Табель учета рабочего времени.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма Т-13 Табель учета рабочего времени.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    order_invoice: {
        key: 'order_invoice',
        name: 'Счет на оплату',
        description: 'Исходящий счет на оплату по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_invoice',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Исходящий_счет_на_оплату.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Исходящий_счет_на_оплату.docx'),
        versionNo: 1,
        isActive: true,
    },
    order_invoice_alt: {
        key: 'order_invoice_alt',
        name: 'Счет на оплату (вариант 2)',
        description: 'Альтернативный исходящий счет на оплату по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_invoice_alt',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Счет_образец.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Счет_образец.docx'),
        versionNo: 1,
        isActive: true,
    },
    order_supply_contract: {
        key: 'order_supply_contract',
        name: 'Договор поставки',
        description: 'Исходящий договор поставки по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_supply_contract',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Договор_поставки.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Договор_поставки.docx'),
        versionNo: 1,
        isActive: true,
    },
    order_supply_specification: {
        key: 'order_supply_specification',
        name: 'Спецификация к договору поставки',
        description: 'Спецификация к договору поставки по заявке.',
        sourceFormat: 'doc',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_supply_specification',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Specifikacia_k_dogovoru_postavki.doc',
        templatePath: path.join(TEMPLATE_DIR, 'Specifikacia_k_dogovoru_postavki.doc'),
        versionNo: 1,
        isActive: true,
    },
    order_service_contract: {
        key: 'order_service_contract',
        name: 'Договор оказания услуг',
        description: 'Исходящий договор оказания услуг по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_service_contract',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Договор_оказания_услуг.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Договор_оказания_услуг.docx'),
        versionNo: 1,
        isActive: true,
    },
    order_work_contract: {
        key: 'order_work_contract',
        name: 'Договор подряда',
        description: 'Исходящий договор подряда по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_work_contract',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Договор_подряда.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Договор_подряда.docx'),
        versionNo: 1,
        isActive: true,
    },
    order_outgoing_act: {
        key: 'order_outgoing_act',
        name: 'Исходящий акт',
        description: 'Исходящий акт по заявке.',
        sourceFormat: 'docx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'order_outgoing_act',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['word', 'pdf'],
        templateName: 'Исходящий_акт.docx',
        templatePath: path.join(TEMPLATE_DIR, 'Исходящий_акт.docx'),
        versionNo: 1,
        isActive: true,
    },
    purchase_upd_status_1: {
        key: 'purchase_upd_status_1',
        name: 'Входящий УПД статус 1',
        description: 'Входящий УПД со статусом 1 по закупке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'purchase_upd_status_1',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма_ УПД со статусом  1  при реализации товаров до 31 март.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма_ УПД со статусом  1  при реализации товаров до 31 март.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    purchase_upd_status_2: {
        key: 'purchase_upd_status_2',
        name: 'Входящий УПД статус 2',
        description: 'Входящий УПД со статусом 2 по закупке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'purchase_upd_status_2',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма_ УПД со статусом  2  до 31 марта 2026 г. включительно.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма_ УПД со статусом  2  до 31 марта 2026 г. включительно.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    purchase_torg_12: {
        key: 'purchase_torg_12',
        name: 'Входящая ТОРГ-12',
        description: 'Входящая товарная накладная по закупке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'purchase_torg_12',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'ТОРГ-12.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'ТОРГ-12.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    shipment_upd_status_1: {
        key: 'shipment_upd_status_1',
        name: 'Исходящий УПД статус 1',
        description: 'Исходящий УПД со статусом 1 по отгрузке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'shipment_upd_status_1',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма_ УПД со статусом  1  при реализации товаров до 31 март.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма_ УПД со статусом  1  при реализации товаров до 31 март.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    shipment_upd_status_2: {
        key: 'shipment_upd_status_2',
        name: 'Исходящий УПД статус 2',
        description: 'Исходящий УПД со статусом 2 по отгрузке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'shipment_upd_status_2',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Форма_ УПД со статусом  2  до 31 марта 2026 г. включительно.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Форма_ УПД со статусом  2  до 31 марта 2026 г. включительно.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    shipment_torg_12: {
        key: 'shipment_torg_12',
        name: 'ТОРГ-12',
        description: 'Исходящая товарная накладная по отгрузке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'shipment_torg_12',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'ТОРГ-12.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'ТОРГ-12.xlsx'),
        versionNo: 1,
        isActive: true,
    },
    shipment_transport_waybill: {
        key: 'shipment_transport_waybill',
        name: 'Транспортная накладная',
        description: 'Транспортная накладная по отгрузке.',
        sourceFormat: 'xlsx',
        rendererKey: 'libreoffice',
        fillStrategyKey: 'shipment_transport_waybill',
        previewMode: 'pdf',
        pdfPostprocess: 'none',
        outputFormats: ['excel', 'pdf'],
        templateName: 'Транспортная накладная.xlsx',
        templatePath: path.join(TEMPLATE_DIR, 'Транспортная накладная.xlsx'),
        versionNo: 1,
        isActive: true,
    },
};

const normalizeOutputFormats = (value: unknown): Array<'excel' | 'pdf' | 'word'> => {
    if (!Array.isArray(value)) return ['excel', 'pdf'];
    const formats = value
        .map((item) => String(item || '').trim().toLowerCase())
        .filter((item): item is 'excel' | 'pdf' | 'word' => item === 'excel' || item === 'pdf' || item === 'word');

    return formats.length ? formats : ['excel', 'pdf'];
};

const normalizeSourceFormat = (value: unknown, fallback: DocumentTemplateSourceFormat): DocumentTemplateSourceFormat => {
    const format = String(value || '').trim().toLowerCase();
    if (format === 'xls' || format === 'xlsx' || format === 'doc' || format === 'docx') return format;
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
    if (strategy === 'finance_payslip') return 'finance_payslip';
    if (strategy === 'finance_timesheet_t13') return 'finance_timesheet_t13';
    if (strategy === 'order_invoice') return 'order_invoice';
    if (strategy === 'order_invoice_alt') return 'order_invoice_alt';
    if (strategy === 'order_supply_contract') return 'order_supply_contract';
    if (strategy === 'order_supply_specification') return 'order_supply_specification';
    if (strategy === 'order_service_contract') return 'order_service_contract';
    if (strategy === 'order_work_contract') return 'order_work_contract';
    if (strategy === 'order_outgoing_act') return 'order_outgoing_act';
    if (strategy === 'purchase_upd_status_1') return 'purchase_upd_status_1';
    if (strategy === 'purchase_upd_status_2') return 'purchase_upd_status_2';
    if (strategy === 'purchase_torg_12') return 'purchase_torg_12';
    if (strategy === 'shipment_upd_status_1') return 'shipment_upd_status_1';
    if (strategy === 'shipment_upd_status_2') return 'shipment_upd_status_2';
    if (strategy === 'shipment_torg_12') return 'shipment_torg_12';
    if (strategy === 'shipment_transport_waybill') return 'shipment_transport_waybill';
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
        const rawResolvedPath = storagePath
            ? (path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath))
            : staticTemplate.templatePath;
        const resolvedPath = await resolveExistingTemplatePath(rawResolvedPath);

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
    if (fromDb) {
        return fromDb;
    }

    const staticTemplate = STATIC_TEMPLATES[templateKey];
    const resolvedPath = await resolveExistingTemplatePath(staticTemplate.templatePath);

    return {
        ...staticTemplate,
        templateName: path.basename(resolvedPath),
        templatePath: resolvedPath,
    };
};
