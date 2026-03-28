import { query } from './db';
import { DEFAULT_VAT_RATE_ID, normalizeVatRateId } from './vat';

export const APP_SETTINGS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS public.app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`;

export const DEFAULT_VAT_SETTINGS_KEY = 'default_vat';

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
