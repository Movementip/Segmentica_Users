export const CLIENT_CONTRAGENT_TYPES = [
    'Организация',
    'Индивидуальный предприниматель',
    'Физическое лицо',
    'Адвокат',
    'Нотариус',
    'Глава КФХ',
    'Иностранный контрагент',
] as const;

export type ClientContragentType = typeof CLIENT_CONTRAGENT_TYPES[number];

export type ClientBankAccount = {
    id?: number;
    name: string;
    bik?: string | null;
    bankName?: string | null;
    correspondentAccount?: string | null;
    settlementAccount?: string | null;
    isPrimary: boolean;
    sortOrder?: number;
};

export type ClientContragent = {
    id: number;
    название: string;
    телефон?: string | null;
    email?: string | null;
    адрес?: string | null;
    тип?: string | null;
    created_at?: string | null;
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
    bankAccounts?: ClientBankAccount[];
};

export type ClientContragentPayload = Omit<ClientContragent, 'id' | 'created_at'>;

type ClientContragentNameSource = {
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

const PERSON_TYPES = new Set<ClientContragentType>([
    'Индивидуальный предприниматель',
    'Физическое лицо',
    'Адвокат',
    'Нотариус',
    'Глава КФХ',
]);

export const normalizeClientContragentType = (value: unknown): ClientContragentType => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return 'Организация';
    if (CLIENT_CONTRAGENT_TYPES.includes(raw as ClientContragentType)) return raw as ClientContragentType;

    const lower = raw.toLowerCase();

    if (lower === 'юр лицо' || lower.includes('корп')) return 'Организация';
    if (lower === 'физ лицо' || lower.includes('розн')) return 'Физическое лицо';
    if (lower.includes('ип')) return 'Индивидуальный предприниматель';
    if (lower.includes('адвокат')) return 'Адвокат';
    if (lower.includes('нотариус')) return 'Нотариус';
    if (lower.includes('кфх')) return 'Глава КФХ';
    if (lower.includes('иностран')) return 'Иностранный контрагент';

    return 'Организация';
};

export const isPersonContragentType = (type?: string | null): boolean => {
    return PERSON_TYPES.has(normalizeClientContragentType(type));
};

export const isOrganizationContragentType = (type?: string | null): boolean => {
    return normalizeClientContragentType(type) === 'Организация';
};

export const isForeignContragentType = (type?: string | null): boolean => {
    return normalizeClientContragentType(type) === 'Иностранный контрагент';
};

export const getClientContragentTypeLabel = (type?: string | null): string => {
    const normalized = normalizeClientContragentType(type);
    if (normalized === 'Индивидуальный предприниматель') return 'ИП';
    return normalized;
};

export const getClientContragentTypeTheme = (type?: string | null):
    | 'organization'
    | 'entrepreneur'
    | 'person'
    | 'advocate'
    | 'notary'
    | 'farm'
    | 'foreign' => {
    const normalized = normalizeClientContragentType(type);
    if (normalized === 'Организация') return 'organization';
    if (normalized === 'Индивидуальный предприниматель') return 'entrepreneur';
    if (normalized === 'Физическое лицо') return 'person';
    if (normalized === 'Адвокат') return 'advocate';
    if (normalized === 'Нотариус') return 'notary';
    if (normalized === 'Глава КФХ') return 'farm';
    return 'foreign';
};

export const normalizeNullableText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

export const normalizeNullableDate = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

export const buildClientDisplayName = (payload: ClientContragentNameSource): string => {
    const type = normalizeClientContragentType(payload.тип);

    if (type === 'Организация') {
        return payload.краткоеНазвание?.trim()
            || payload.полноеНазвание?.trim()
            || payload.название?.trim()
            || '';
    }

    if (type === 'Иностранный контрагент') {
        return payload.название?.trim()
            || payload.полноеНазвание?.trim()
            || payload.краткоеНазвание?.trim()
            || '';
    }

    return [payload.фамилия, payload.имя, payload.отчество]
        .map((part) => typeof part === 'string' ? part.trim() : '')
        .filter(Boolean)
        .join(' ');
};

export const buildClientPrimaryAddress = (payload: ClientContragentNameSource): string | null => {
    return payload.адресПечати?.trim()
        || payload.адресРегистрации?.trim()
        || payload.адрес?.trim()
        || null;
};

export const normalizeBankAccounts = (accounts: unknown): ClientBankAccount[] => {
    if (!Array.isArray(accounts)) return [];

    const normalized = accounts
        .map((item, index) => {
            const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
            const rawName = normalizeNullableText(row.name);
            const rawBik = normalizeNullableText(row.bik);
            const rawBankName = normalizeNullableText(row.bankName);
            const rawCorrespondentAccount = normalizeNullableText(row.correspondentAccount);
            const rawSettlementAccount = normalizeNullableText(row.settlementAccount);
            const hasMeaningfulValue = Boolean(
                rawName || rawBik || rawBankName || rawCorrespondentAccount || rawSettlementAccount
            );
            const name = normalizeNullableText(row.name) || (index === 0 ? 'Основной расчетный счет' : `Расчетный счет ${index + 1}`);
            const isPrimary = Boolean(row.isPrimary) || index === 0;
            const normalizedRow: ClientBankAccount = {
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
