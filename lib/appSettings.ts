import { query } from './db';
import { DEFAULT_VAT_RATE_ID, normalizeVatRateId } from './vat';
import {
    DEFAULT_ORDER_EXECUTION_MODE,
    type OrderExecutionMode,
    normalizeOrderExecutionMode,
} from './orderModes';

export const APP_SETTINGS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS public.app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

export const DEFAULT_VAT_SETTINGS_KEY = 'default_vat';
export const DEFAULT_ORDER_EXECUTION_MODE_SETTINGS_KEY = 'default_order_execution_mode';
export const AUTO_CALCULATE_SHIPMENT_DELIVERY_COST_SETTINGS_KEY = 'auto_calculate_shipment_delivery_cost';

export const ensureAppSettingsTable = async () => {
    await query(APP_SETTINGS_TABLE_SQL);
};

export const getDefaultVatRateId = async (): Promise<number> => {
    await ensureAppSettingsTable();
    const res = await query(
        `SELECT value
         FROM public.app_settings
         WHERE key = $1
         LIMIT 1`,
        [DEFAULT_VAT_SETTINGS_KEY]
    );

    const raw = res.rows?.[0]?.value;
    if (!raw || typeof raw !== 'object') {
        return DEFAULT_VAT_RATE_ID;
    }

    const candidate = (raw as any).vatRateId ?? (raw as any).defaultVatRateId ?? DEFAULT_VAT_RATE_ID;
    return normalizeVatRateId(candidate);
};

export const saveDefaultVatRateId = async (vatRateId: number) => {
    await ensureAppSettingsTable();
    await query(
        `
        INSERT INTO public.app_settings(key, value, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `,
        [DEFAULT_VAT_SETTINGS_KEY, JSON.stringify({ vatRateId: normalizeVatRateId(vatRateId) })]
    );
};

export const getDefaultOrderExecutionMode = async (): Promise<OrderExecutionMode> => {
    await ensureAppSettingsTable();
    const res = await query(
        `SELECT value
         FROM public.app_settings
         WHERE key = $1
         LIMIT 1`,
        [DEFAULT_ORDER_EXECUTION_MODE_SETTINGS_KEY]
    );

    const raw = res.rows?.[0]?.value;
    if (!raw || typeof raw !== 'object') {
        return DEFAULT_ORDER_EXECUTION_MODE;
    }

    const candidate = (raw as any).value ?? (raw as any).executionMode ?? DEFAULT_ORDER_EXECUTION_MODE;
    return normalizeOrderExecutionMode(candidate);
};

export const saveDefaultOrderExecutionMode = async (executionMode: OrderExecutionMode) => {
    await ensureAppSettingsTable();
    await query(
        `
        INSERT INTO public.app_settings(key, value, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `,
        [DEFAULT_ORDER_EXECUTION_MODE_SETTINGS_KEY, JSON.stringify({ value: normalizeOrderExecutionMode(executionMode) })]
    );
};

export const getAutoCalculateShipmentDeliveryCost = async (): Promise<boolean> => {
    await ensureAppSettingsTable();
    const res = await query(
        `SELECT value
         FROM public.app_settings
         WHERE key = $1
         LIMIT 1`,
        [AUTO_CALCULATE_SHIPMENT_DELIVERY_COST_SETTINGS_KEY]
    );

    const raw = res.rows?.[0]?.value;
    if (!raw || typeof raw !== 'object') {
        return false;
    }

    const candidate = (raw as any).enabled ?? (raw as any).value ?? false;
    return candidate === true || String(candidate).trim().toLowerCase() === 'true';
};

export const saveAutoCalculateShipmentDeliveryCost = async (enabled: boolean) => {
    await ensureAppSettingsTable();
    await query(
        `
        INSERT INTO public.app_settings(key, value, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `,
        [AUTO_CALCULATE_SHIPMENT_DELIVERY_COST_SETTINGS_KEY, JSON.stringify({ enabled: Boolean(enabled) })]
    );
};
