import type { DocumentTemplateKey } from './documentTemplates';

export type ShipmentDocumentKey = Extract<
    DocumentTemplateKey,
    'shipment_upd_status_1' | 'shipment_upd_status_2' | 'shipment_torg_12' | 'shipment_transport_waybill'
>;

export type ShipmentDocumentOutputFormat = 'pdf' | 'excel';

export type ShipmentDocumentDefinition = {
    key: ShipmentDocumentKey;
    title: string;
    outputFormats: ShipmentDocumentOutputFormat[];
};

export type ShipmentDocumentAvailabilityContext = {
    nomenclatureTypes: string[];
    usesDelivery: boolean;
};

const GOODS_NOMENCLATURE_TYPES = new Set([
    'товар',
    'материал',
    'продукция',
    'внеоборотный_актив',
]);

export const SHIPMENT_DOCUMENT_DEFINITIONS: Record<ShipmentDocumentKey, ShipmentDocumentDefinition> = {
    shipment_upd_status_1: {
        key: 'shipment_upd_status_1',
        title: 'Исходящий УПД статус 1',
        outputFormats: ['pdf', 'excel'],
    },
    shipment_upd_status_2: {
        key: 'shipment_upd_status_2',
        title: 'Исходящий УПД статус 2',
        outputFormats: ['pdf', 'excel'],
    },
    shipment_torg_12: {
        key: 'shipment_torg_12',
        title: 'ТОРГ-12',
        outputFormats: ['pdf', 'excel'],
    },
    shipment_transport_waybill: {
        key: 'shipment_transport_waybill',
        title: 'Транспортная накладная',
        outputFormats: ['pdf', 'excel'],
    },
};

export const normalizeShipmentDocumentKey = (value: string | null | undefined): ShipmentDocumentKey | null => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'shipment_upd_status_1') return 'shipment_upd_status_1';
    if (normalized === 'shipment_upd_status_2') return 'shipment_upd_status_2';
    if (normalized === 'shipment_torg_12') return 'shipment_torg_12';
    if (normalized === 'shipment_transport_waybill') return 'shipment_transport_waybill';
    return null;
};

export const getShipmentDocumentDefinition = (key: ShipmentDocumentKey): ShipmentDocumentDefinition =>
    SHIPMENT_DOCUMENT_DEFINITIONS[key];

export const getAvailableShipmentDocumentDefinitions = (
    context: ShipmentDocumentAvailabilityContext
): ShipmentDocumentDefinition[] => {
    const normalizedTypes = Array.from(
        new Set(
            (context.nomenclatureTypes || [])
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        )
    );

    const hasGoods = normalizedTypes.some((value) => GOODS_NOMENCLATURE_TYPES.has(value));
    const definitions: ShipmentDocumentDefinition[] = [];

    if (hasGoods) {
        definitions.push(
            SHIPMENT_DOCUMENT_DEFINITIONS.shipment_upd_status_1,
            SHIPMENT_DOCUMENT_DEFINITIONS.shipment_upd_status_2,
            SHIPMENT_DOCUMENT_DEFINITIONS.shipment_torg_12,
        );
    }

    if (context.usesDelivery) {
        definitions.push(SHIPMENT_DOCUMENT_DEFINITIONS.shipment_transport_waybill);
    }

    return definitions;
};
