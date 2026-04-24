import type { DocumentTemplateKey } from '../types/documentTemplates';

export type PurchaseDocumentKey = Extract<
    DocumentTemplateKey,
    | 'purchase_invoice'
    | 'purchase_upd_status_1'
    | 'purchase_upd_status_2'
    | 'purchase_torg_12'
>;

export type PurchaseDocumentOutputFormat = 'pdf' | 'excel' | 'word';

export type PurchaseDocumentDefinition = {
    key: PurchaseDocumentKey;
    title: string;
    outputFormats: PurchaseDocumentOutputFormat[];
};

export type PurchaseDocumentAvailabilityContext = {
    nomenclatureTypes: string[];
};

const GOODS_NOMENCLATURE_TYPES = new Set([
    'товар',
    'материал',
    'продукция',
    'внеоборотный_актив',
]);

export const PURCHASE_DOCUMENT_DEFINITIONS: Record<PurchaseDocumentKey, PurchaseDocumentDefinition> = {
    purchase_invoice: {
        key: 'purchase_invoice',
        title: 'Счет',
        outputFormats: ['pdf', 'word'],
    },
    purchase_upd_status_1: {
        key: 'purchase_upd_status_1',
        title: 'Входящий УПД статус 1',
        outputFormats: ['pdf', 'excel'],
    },
    purchase_upd_status_2: {
        key: 'purchase_upd_status_2',
        title: 'Входящий УПД статус 2',
        outputFormats: ['pdf', 'excel'],
    },
    purchase_torg_12: {
        key: 'purchase_torg_12',
        title: 'Входящая ТОРГ-12',
        outputFormats: ['pdf', 'excel'],
    },
};

export const normalizePurchaseDocumentKey = (value: string | null | undefined): PurchaseDocumentKey | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'purchase_invoice') return 'purchase_invoice';
    if (normalized === 'purchase_upd_status_1') return 'purchase_upd_status_1';
    if (normalized === 'purchase_upd_status_2') return 'purchase_upd_status_2';
    if (normalized === 'purchase_torg_12') return 'purchase_torg_12';
    return null;
};

export const getPurchaseDocumentDefinition = (key: PurchaseDocumentKey): PurchaseDocumentDefinition =>
    PURCHASE_DOCUMENT_DEFINITIONS[key];

export const getAvailablePurchaseDocumentDefinitions = (
    context: PurchaseDocumentAvailabilityContext
): PurchaseDocumentDefinition[] => {
    const normalizedTypes = Array.from(
        new Set(
            (context.nomenclatureTypes || [])
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        )
    );

    const hasGoods = normalizedTypes.some((value) => GOODS_NOMENCLATURE_TYPES.has(value));
    const definitions: PurchaseDocumentDefinition[] = [
        PURCHASE_DOCUMENT_DEFINITIONS.purchase_invoice,
    ];

    if (hasGoods) {
        definitions.push(
            PURCHASE_DOCUMENT_DEFINITIONS.purchase_upd_status_1,
            PURCHASE_DOCUMENT_DEFINITIONS.purchase_upd_status_2,
            PURCHASE_DOCUMENT_DEFINITIONS.purchase_torg_12,
        );
    }

    return definitions;
};
