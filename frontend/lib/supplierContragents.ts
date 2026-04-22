export const SUPPLIER_CONTRAGENT_TYPES = [
    'Организация',
    'Индивидуальный предприниматель',
    'Физическое лицо',
] as const;

export type SupplierContragentType = typeof SUPPLIER_CONTRAGENT_TYPES[number];

export type SupplierBankAccount = {
    id?: number;
    name: string;
    bik?: string | null;
    bankName?: string | null;
    correspondentAccount?: string | null;
    settlementAccount?: string | null;
    isPrimary: boolean;
    sortOrder?: number;
};

export type SupplierContragent = {
    id: number;
    название: string;
    телефон?: string | null;
    email?: string | null;
    адрес?: string | null;
    тип?: string | null;
    created_at?: string | null;
    рейтинг?: number | null;
    краткоеНазвание?: string | null;
    полноеНазвание?: string | null;
    фамилия?: string | null;
    имя?: string | null;
    отчество?: string | null;
    инн?: string | null;
    кпп?: string | null;
    огрн?: string | null;
    огрнип?: string | null;
    окпо?: string | null;
    адресРегистрации?: string | null;
    адресПечати?: string | null;
    паспортСерия?: string | null;
    паспортНомер?: string | null;
    паспортКемВыдан?: string | null;
    паспортДатаВыдачи?: string | null;
    паспортКодПодразделения?: string | null;
    комментарий?: string | null;
    bankAccounts?: SupplierBankAccount[];
};

export type SupplierContragentPayload = Omit<SupplierContragent, 'id' | 'created_at'>;

type SupplierContragentNameSource = {
    название?: string | null;
    тип?: string | null;
    краткоеНазвание?: string | null;
    полноеНазвание?: string | null;
    фамилия?: string | null;
    имя?: string | null;
    отчество?: string | null;
    адрес?: string | null;
    адресРегистрации?: string | null;
    адресПечати?: string | null;
};

const PERSON_TYPES = new Set<SupplierContragentType>([
    'Индивидуальный предприниматель',
    'Физическое лицо',
]);

export const normalizeSupplierContragentType = (value: unknown): SupplierContragentType => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return 'Организация';
    if (SUPPLIER_CONTRAGENT_TYPES.includes(raw as SupplierContragentType)) return raw as SupplierContragentType;

    const lower = raw.toLowerCase();

    if (lower === 'юр лицо' || lower.includes('орган') || lower.includes('корп')) return 'Организация';
    if (lower === 'физ лицо' || lower.includes('физ')) return 'Физическое лицо';
    if (lower.includes('ип')) return 'Индивидуальный предприниматель';

    return 'Организация';
};

export const isSupplierPersonContragentType = (type?: string | null): boolean => {
    return PERSON_TYPES.has(normalizeSupplierContragentType(type));
};

export const isSupplierOrganizationContragentType = (type?: string | null): boolean => {
    return normalizeSupplierContragentType(type) === 'Организация';
};

export const getSupplierContragentTypeLabel = (type?: string | null): string => {
    const normalized = normalizeSupplierContragentType(type);
    if (normalized === 'Индивидуальный предприниматель') return 'ИП';
    return normalized;
};

export const getSupplierContragentTypeTheme = (type?: string | null): 'organization' | 'entrepreneur' | 'person' => {
    const normalized = normalizeSupplierContragentType(type);
    if (normalized === 'Организация') return 'organization';
    if (normalized === 'Индивидуальный предприниматель') return 'entrepreneur';
    return 'person';
};

export const normalizeNullableSupplierText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

export const normalizeNullableSupplierDate = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

export const buildSupplierDisplayName = (payload: SupplierContragentNameSource): string => {
    const type = normalizeSupplierContragentType(payload.тип);

    if (type === 'Организация') {
        return payload.краткоеНазвание?.trim()
            || payload.полноеНазвание?.trim()
            || payload.название?.trim()
            || '';
    }

    return [payload.фамилия, payload.имя, payload.отчество]
        .map((part) => typeof part === 'string' ? part.trim() : '')
        .filter(Boolean)
        .join(' ');
};

export const buildSupplierPrimaryAddress = (payload: SupplierContragentNameSource): string | null => {
    return payload.адресПечати?.trim()
        || payload.адресРегистрации?.trim()
        || payload.адрес?.trim()
        || null;
};

export const normalizeSupplierBankAccounts = (accounts: unknown): SupplierBankAccount[] => {
    if (!Array.isArray(accounts)) return [];

    const normalized = accounts
        .map((item, index) => {
            const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
            const rawName = normalizeNullableSupplierText(row.name);
            const rawBik = normalizeNullableSupplierText(row.bik);
            const rawBankName = normalizeNullableSupplierText(row.bankName);
            const rawCorrespondentAccount = normalizeNullableSupplierText(row.correspondentAccount);
            const rawSettlementAccount = normalizeNullableSupplierText(row.settlementAccount);
            const hasMeaningfulValue = Boolean(
                rawName || rawBik || rawBankName || rawCorrespondentAccount || rawSettlementAccount
            );
            const name = rawName || (index === 0 ? 'Основной расчетный счет' : `Расчетный счет ${index + 1}`);
            const isPrimary = Boolean(row.isPrimary) || index === 0;
            const normalizedRow: SupplierBankAccount = {
                id: typeof row.id === 'number' ? row.id : undefined,
                name,
                bik: rawBik,
                bankName: rawBankName,
                correspondentAccount: rawCorrespondentAccount,
                settlementAccount: rawSettlementAccount,
                isPrimary,
                sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
            };
            return { normalizedRow, hasMeaningfulValue };
        })
        .filter((row) => row.hasMeaningfulValue)
        .map((row) => row.normalizedRow);

    if (normalized.length === 0) return [];

    const firstPrimaryIndex = normalized.findIndex((item) => item.isPrimary);
    if (firstPrimaryIndex === -1) {
        normalized[0].isPrimary = true;
    } else {
        normalized.forEach((item, index) => {
            item.isPrimary = index === firstPrimaryIndex;
        });
    }

    return normalized;
};
