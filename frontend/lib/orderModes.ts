import { DEFAULT_VAT_RATE_ID, normalizeVatRateId } from './vat';

export const ORDER_EXECUTION_MODE_VALUES = ['warehouse', 'direct'] as const;
export const ORDER_SUPPLY_MODE_VALUES = ['auto', 'purchase', 'manual'] as const;

export type OrderExecutionMode = (typeof ORDER_EXECUTION_MODE_VALUES)[number];
export type OrderSupplyMode = (typeof ORDER_SUPPLY_MODE_VALUES)[number];

export const DEFAULT_ORDER_EXECUTION_MODE: OrderExecutionMode = 'warehouse';
export const DEFAULT_ORDER_SUPPLY_MODE: OrderSupplyMode = 'auto';

export const isOrderExecutionMode = (value: unknown): value is OrderExecutionMode => (
    ORDER_EXECUTION_MODE_VALUES.includes(String(value || '').trim().toLowerCase() as OrderExecutionMode)
);

export const normalizeOrderExecutionMode = (value: unknown): OrderExecutionMode => (
    isOrderExecutionMode(value) ? String(value).trim().toLowerCase() as OrderExecutionMode : DEFAULT_ORDER_EXECUTION_MODE
);

export const isOrderSupplyMode = (value: unknown): value is OrderSupplyMode => (
    ORDER_SUPPLY_MODE_VALUES.includes(String(value || '').trim().toLowerCase() as OrderSupplyMode)
);

export const normalizeOrderSupplyMode = (value: unknown, executionMode: unknown = DEFAULT_ORDER_EXECUTION_MODE): OrderSupplyMode => {
    const normalizedExecutionMode = normalizeOrderExecutionMode(executionMode);

    if (normalizedExecutionMode === 'warehouse') {
        return DEFAULT_ORDER_SUPPLY_MODE;
    }

    return isOrderSupplyMode(value) ? String(value).trim().toLowerCase() as OrderSupplyMode : 'purchase';
};

export const getOrderExecutionModeLabel = (value: unknown): string => (
    normalizeOrderExecutionMode(value) === 'direct' ? 'Без склада' : 'Со складом'
);

export const getOrderSupplyModeLabel = (value: unknown): string => {
    switch (normalizeOrderSupplyMode(value, 'direct')) {
        case 'purchase':
            return 'Через закупку';
        case 'manual':
            return 'Без закупки';
        default:
            return 'Авто';
    }
};

export interface OrderDefaultsPayload {
    defaultVatRateId: number;
    defaultOrderExecutionMode: OrderExecutionMode;
    autoCalculateShipmentDeliveryCost: boolean;
}

export const fetchOrderDefaults = async (): Promise<OrderDefaultsPayload> => {
    try {
        const response = await fetch('/api/settings/order-defaults');
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return {
                defaultVatRateId: DEFAULT_VAT_RATE_ID,
                defaultOrderExecutionMode: DEFAULT_ORDER_EXECUTION_MODE,
                autoCalculateShipmentDeliveryCost: false,
            };
        }

        return {
            defaultVatRateId: normalizeVatRateId((data as any)?.defaultVatRateId),
            defaultOrderExecutionMode: normalizeOrderExecutionMode((data as any)?.defaultOrderExecutionMode),
            autoCalculateShipmentDeliveryCost: Boolean((data as any)?.autoCalculateShipmentDeliveryCost),
        };
    } catch {
        return {
            defaultVatRateId: DEFAULT_VAT_RATE_ID,
            defaultOrderExecutionMode: DEFAULT_ORDER_EXECUTION_MODE,
            autoCalculateShipmentDeliveryCost: false,
        };
    }
};

export const fetchDefaultOrderExecutionMode = async (): Promise<OrderExecutionMode> => {
    const defaults = await fetchOrderDefaults();
    return defaults.defaultOrderExecutionMode;
};
