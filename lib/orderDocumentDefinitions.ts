import type { DocumentTemplateKey } from './documentTemplates';

export type OrderDocumentKey = Extract<
    DocumentTemplateKey,
    'order_invoice' | 'order_supply_contract' | 'order_service_contract' | 'order_work_contract' | 'order_outgoing_act'
>;

export type OrderDocumentOutputFormat = 'pdf' | 'word';

export type OrderDocumentDefinition = {
    key: OrderDocumentKey;
    title: string;
    outputFormats: OrderDocumentOutputFormat[];
};

export type OrderDocumentAvailabilityContext = {
    nomenclatureTypes: string[];
};

const GOODS_NOMENCLATURE_TYPES = new Set([
    'товар',
    'материал',
    'продукция',
    'внеоборотный_актив',
]);

export const ORDER_DOCUMENT_DEFINITIONS: Record<OrderDocumentKey, OrderDocumentDefinition> = {
    order_invoice: {
        key: 'order_invoice',
        title: 'Счет на оплату',
        outputFormats: ['pdf', 'word'],
    },
    order_supply_contract: {
        key: 'order_supply_contract',
        title: 'Договор поставки',
        outputFormats: ['pdf', 'word'],
    },
    order_service_contract: {
        key: 'order_service_contract',
        title: 'Договор оказания услуг',
        outputFormats: ['pdf', 'word'],
    },
    order_work_contract: {
        key: 'order_work_contract',
        title: 'Договор подряда',
        outputFormats: ['pdf', 'word'],
    },
    order_outgoing_act: {
        key: 'order_outgoing_act',
        title: 'Исходящий акт',
        outputFormats: ['pdf', 'word'],
    },
};

export const normalizeOrderDocumentKey = (value: string | null | undefined): OrderDocumentKey | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'order_invoice') return 'order_invoice';
    if (normalized === 'order_supply_contract') return 'order_supply_contract';
    if (normalized === 'order_service_contract') return 'order_service_contract';
    if (normalized === 'order_work_contract') return 'order_work_contract';
    if (normalized === 'order_outgoing_act') return 'order_outgoing_act';
    return null;
};

export const getOrderDocumentDefinition = (key: OrderDocumentKey): OrderDocumentDefinition =>
    ORDER_DOCUMENT_DEFINITIONS[key];

export const getAvailableOrderDocumentDefinitions = (
    context: OrderDocumentAvailabilityContext
): OrderDocumentDefinition[] => {
    const normalizedTypes = Array.from(
        new Set(
            (context.nomenclatureTypes || [])
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        )
    );

    const hasGoods = normalizedTypes.some((value) => GOODS_NOMENCLATURE_TYPES.has(value));
    const hasOutgoingServices = normalizedTypes.includes('исходящая_услуга');

    const definitions: OrderDocumentDefinition[] = [
        ORDER_DOCUMENT_DEFINITIONS.order_invoice,
    ];

    if (hasGoods) {
        definitions.push(ORDER_DOCUMENT_DEFINITIONS.order_supply_contract);
    }

    if (hasOutgoingServices) {
        definitions.push(
            ORDER_DOCUMENT_DEFINITIONS.order_service_contract,
            ORDER_DOCUMENT_DEFINITIONS.order_work_contract,
            ORDER_DOCUMENT_DEFINITIONS.order_outgoing_act,
        );
    }

    return definitions;
};
