import { query } from './db';
import { getDocumentTemplateDefinition, type DocumentTemplateDefinition } from './documentTemplates';
import type { RenderXlsxTemplateParams } from './documentRendererClient';
import {
    getAvailablePurchaseDocumentDefinitions,
    getPurchaseDocumentDefinition,
    type PurchaseDocumentKey,
} from './purchaseDocumentDefinitions';
import {
    buildSupplierDisplayName,
    buildSupplierPrimaryAddress,
    normalizeSupplierContragentType,
    type SupplierBankAccount,
} from './supplierContragents';

type PurchaseDocumentRow = {
    id: number;
    дата_заказа: string;
    дата_поступления: string | null;
    поставщик_id: number;
    использовать_доставку: boolean;
    стоимость_доставки: number | null;
    транспорт_название: string | null;
    поставщик_название?: string | null;
    поставщик_тип?: string | null;
    поставщик_краткое_название?: string | null;
    поставщик_полное_название?: string | null;
    поставщик_фамилия?: string | null;
    поставщик_имя?: string | null;
    поставщик_отчество?: string | null;
    поставщик_инн?: string | null;
    поставщик_кпп?: string | null;
    поставщик_окпо?: string | null;
    поставщик_адрес?: string | null;
    поставщик_адрес_регистрации?: string | null;
    поставщик_адрес_печати?: string | null;
    поставщик_email?: string | null;
    поставщик_телефон?: string | null;
};

type PurchaseDocumentPosition = {
    id: number;
    товар_название: string;
    товар_артикул: string | null;
    товар_единица_измерения: string | null;
    товар_тип_номенклатуры: string | null;
    количество: number;
    цена: number;
    сумма_без_ндс: number;
    сумма_ндс: number;
    сумма_всего: number;
    ндс_ставка: number;
};

type StatementActor = {
    fio: string;
    position: string | null;
};

type CompanyProfile = {
    displayName: string;
    legalName: string;
    legalAddress: string;
    documentAddress: string;
    inn: string;
    kpp: string;
    ogrn: string;
    okpo: string;
    oktmo: string;
    okato: string;
    okved: string;
    activityCode: string;
    bankName: string;
    bik: string;
    correspondentAccount: string;
    settlementAccount: string;
    phone: string;
    email: string;
    city: string;
    directorName: string;
    directorPosition: string;
    accountantName: string;
    accountantPosition: string;
    paymentTerms: string;
};

export type PurchaseDocumentRenderPayload = {
    documentTitle: string;
    template: DocumentTemplateDefinition;
    fileBaseName: string;
    cells?: RenderXlsxTemplateParams['cells'];
    replacements?: Record<string, string>;
    replaceFirstImageBase64?: string;
    rowVisibility?: RenderXlsxTemplateParams['rowVisibility'];
    rowBreaks?: RenderXlsxTemplateParams['rowBreaks'];
    printAreas?: RenderXlsxTemplateParams['printAreas'];
    rangeCopies?: RenderXlsxTemplateParams['rangeCopies'];
    sheetCopies?: RenderXlsxTemplateParams['sheetCopies'];
    hiddenSheets?: string[];
    sheetPageSetup?: RenderXlsxTemplateParams['sheetPageSetup'];
    pdfPostprocess: RenderXlsxTemplateParams['postprocess'];
};

const COMPANY_PROFILE_SETTINGS_KEY = 'company_profile';

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
    displayName: 'ООО "СЕГМЕНТИКА"',
    legalName: 'Общество с ограниченной ответственностью "Сегментика"',
    legalAddress: '620061, Свердловская обл, город Екатеринбург г.о., Исток п, Главная ул, строение 21, помещение 421',
    documentAddress: '620061, Свердловская обл, город Екатеринбург г.о., Исток п, Главная ул, строение 21, помещение 421',
    inn: '6685205790',
    kpp: '668501001',
    ogrn: '1226600072577',
    okpo: '95164141',
    oktmo: '65701000',
    okato: '65401380002',
    okved: '46.73.6',
    activityCode: '46.73.6',
    bankName: 'СБЕРБАНК',
    bik: '782347238904238904',
    correspondentAccount: '7283489324879234',
    settlementAccount: '345345345',
    phone: '89193730303',
    email: 'segmenica@ru',
    city: 'Екатеринбург',
    directorName: 'Юдин Роман Игоревич',
    directorPosition: 'Генеральный директор',
    accountantName: 'Юдин Роман Игоревич',
    accountantPosition: 'Главный бухгалтер',
    paymentTerms: '',
};

const TORG_ITEM_ROWS = [
    30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
    47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
];
const TORG_FIRST_PAGE_ITEM_ROWS = TORG_ITEM_ROWS.filter((row) => row >= 30 && row <= 41);
const TORG_SECOND_PAGE_ITEM_ROWS = TORG_ITEM_ROWS.filter((row) => row >= 47 && row <= 61);
const TORG_ACTIVITY_CODE = '43.76.6';
const TORG_FIRST_PAGE_BREAK_ROW = 42;
const TORG_FOOTER_PAGE_BREAK_ROW = 63;

const UNIT_CODE_MAP: Record<string, string> = {
    шт: '796',
    кг: '166',
    г: '163',
    л: '112',
    м: '006',
    м2: '055',
    м3: '113',
    усл: '',
    услуга: '',
};

const normalizeNullableText = (value: unknown): string => {
    if (value == null) return '';
    const text = String(value).trim();
    return text || '';
};

const toShortFio = (value: string | null | undefined): string => {
    const normalized = normalizeNullableText(value);
    if (!normalized) return '';
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const [lastName, firstName = '', middleName = ''] = parts;
    const initials = [firstName, middleName]
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}.`)
        .join(' ');
    return initials ? `${lastName} ${initials}` : lastName;
};

const parseDateOnly = (value: string | null | undefined): Date => {
    const parsed = new Date(String(value || ''));
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatDateRuNumeric = (value: Date): string => {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    return `${day}.${month}.${year}`;
};

const formatDateRuLong = (value: Date): string => {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });

    const formatted = formatter.format(value);
    return formatted.includes('г.') ? formatted : `${formatted} г.`;
};

const getMonthRuGenitive = (value: Date): string => {
    const months = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря',
    ];

    return months[value.getUTCMonth()] || '';
};

const formatDateRuParts = (value: Date): { day: string; month: string; year: string } => ({
    day: String(value.getUTCDate()).padStart(2, '0'),
    month: getMonthRuGenitive(value),
    year: String(value.getUTCFullYear()),
});

const formatMoney = (value: number): string =>
    new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const declOfNum = (n: number, titles: [string, string, string]) => {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
};

const numToWordsRu = (value: number, female: boolean) => {
    const onesMale = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const onesFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    const num = Math.floor(value);
    if (num === 0) return 'ноль';

    const triadToWords = (n: number, isFemale: boolean) => {
        const ones = isFemale ? onesFemale : onesMale;
        const result: string[] = [];
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;
        if (h) result.push(hundreds[h]);
        if (t === 1) {
            result.push(teens[u]);
        } else {
            if (t) result.push(tens[t]);
            if (u) result.push(ones[u]);
        }
        return result;
    };

    const parts: string[] = [];
    let rest = num;

    const billions = Math.floor(rest / 1_000_000_000);
    rest %= 1_000_000_000;
    const millions = Math.floor(rest / 1_000_000);
    rest %= 1_000_000;
    const thousands = Math.floor(rest / 1_000);
    rest %= 1_000;

    if (billions) {
        parts.push(...triadToWords(billions, false));
        parts.push(declOfNum(billions, ['миллиард', 'миллиарда', 'миллиардов']));
    }
    if (millions) {
        parts.push(...triadToWords(millions, false));
        parts.push(declOfNum(millions, ['миллион', 'миллиона', 'миллионов']));
    }
    if (thousands) {
        parts.push(...triadToWords(thousands, true));
        parts.push(declOfNum(thousands, ['тысяча', 'тысячи', 'тысяч']));
    }
    if (rest) {
        parts.push(...triadToWords(rest, female));
    }

    return parts.filter(Boolean).join(' ');
};

const amountToWordsRub = (amount: number): string => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const rub = Math.floor(safeAmount + 1e-9);
    const kop = Math.round((safeAmount - rub) * 100);
    const rubWords = numToWordsRu(rub, false);
    const rubTitle = declOfNum(rub, ['рубль', 'рубля', 'рублей']);
    const kopTitle = declOfNum(kop, ['копейка', 'копейки', 'копеек']);
    return `${rubWords} ${rubTitle} ${String(kop).padStart(2, '0')} ${kopTitle}`;
};

const buildFileBaseName = (title: string, purchaseId: number): string =>
    `${title} Закупка ${purchaseId}`;

const buildPurchaseBasis = (purchaseId: number, documentDate: Date): string =>
    `Закупка № ${purchaseId} от ${formatDateRuNumeric(documentDate)}`;

const buildPurchaseItemsBlock = (positions: PurchaseDocumentPosition[]): string =>
    positions
        .map((position, index) => {
            const quantity = position.количество % 1 === 0
                ? String(position.количество)
                : String(position.количество).replace('.', ',');
            return `\t\t${index + 1}. ${position.товар_название} — ${quantity} ${position.товар_единица_измерения || 'шт'} × ${formatMoney(position.цена)} руб. = ${formatMoney(position.сумма_всего)} руб.`;
        })
        .join('\n');

const buildPurchaseInvoiceStructuredRows = (positions: PurchaseDocumentPosition[]) =>
    positions.map((position, index) => {
        const quantity = position.количество % 1 === 0
            ? String(position.количество)
            : String(position.количество).replace('.', ',');
        return {
            number: String(index + 1),
            name: position.товар_название,
            unit: normalizeNullableText(position.товар_единица_измерения),
            quantity,
            price: formatMoney(position.цена),
            sum: formatMoney(position.сумма_всего),
        };
    });

const getCompanyProfile = async (): Promise<CompanyProfile> => {
    try {
        const res = await query(
            `
            SELECT value
            FROM public.app_settings
            WHERE key = $1
            LIMIT 1
            `,
            [COMPANY_PROFILE_SETTINGS_KEY]
        );

        const raw = res.rows?.[0]?.value;
        if (!raw || typeof raw !== 'object') {
            return DEFAULT_COMPANY_PROFILE;
        }

        const value = raw as Record<string, unknown>;
        return {
            displayName: normalizeNullableText(value.displayName ?? value.shortName) || DEFAULT_COMPANY_PROFILE.displayName,
            legalName: normalizeNullableText(value.legalName ?? value.fullName) || DEFAULT_COMPANY_PROFILE.legalName,
            legalAddress: normalizeNullableText(value.legalAddress ?? value.address) || DEFAULT_COMPANY_PROFILE.legalAddress,
            documentAddress: normalizeNullableText(value.documentAddress ?? value.postalAddress) || DEFAULT_COMPANY_PROFILE.documentAddress,
            inn: normalizeNullableText(value.inn) || DEFAULT_COMPANY_PROFILE.inn,
            kpp: normalizeNullableText(value.kpp) || DEFAULT_COMPANY_PROFILE.kpp,
            ogrn: normalizeNullableText(value.ogrn) || DEFAULT_COMPANY_PROFILE.ogrn,
            okpo: normalizeNullableText(value.okpo) || DEFAULT_COMPANY_PROFILE.okpo,
            oktmo: normalizeNullableText(value.oktmo) || DEFAULT_COMPANY_PROFILE.oktmo,
            okato: normalizeNullableText(value.okato) || DEFAULT_COMPANY_PROFILE.okato,
            okved: normalizeNullableText(value.okved ?? value.mainOkved) || DEFAULT_COMPANY_PROFILE.okved,
            activityCode: normalizeNullableText(value.activityCode ?? value.okdp ?? value.okved ?? value.mainOkved) || DEFAULT_COMPANY_PROFILE.activityCode,
            bankName: normalizeNullableText(value.bankName ?? value.bank) || DEFAULT_COMPANY_PROFILE.bankName,
            bik: normalizeNullableText(value.bik) || DEFAULT_COMPANY_PROFILE.bik,
            correspondentAccount: normalizeNullableText(value.correspondentAccount ?? value.ks) || DEFAULT_COMPANY_PROFILE.correspondentAccount,
            settlementAccount: normalizeNullableText(value.settlementAccount ?? value.rs) || DEFAULT_COMPANY_PROFILE.settlementAccount,
            phone: normalizeNullableText(value.phone) || DEFAULT_COMPANY_PROFILE.phone,
            email: normalizeNullableText(value.email) || DEFAULT_COMPANY_PROFILE.email,
            city: normalizeNullableText(value.city) || DEFAULT_COMPANY_PROFILE.city,
            directorName: normalizeNullableText(
                value.directorName ?? value.generalDirectorName ?? value.signatoryName ?? value.fioForSignature
            ) || DEFAULT_COMPANY_PROFILE.directorName,
            directorPosition: normalizeNullableText(
                value.directorPosition ?? value.generalDirectorPosition ?? value.signatoryPosition ?? value.positionForSignature
            ) || DEFAULT_COMPANY_PROFILE.directorPosition,
            accountantName: normalizeNullableText(
                value.accountantName ?? value.chiefAccountantName ?? value.chiefAccountantFio ?? value.accountantFio
            ) || DEFAULT_COMPANY_PROFILE.accountantName,
            accountantPosition: normalizeNullableText(
                value.accountantPosition ?? value.chiefAccountantPosition ?? value.accountantTitle
            ) || DEFAULT_COMPANY_PROFILE.accountantPosition,
            paymentTerms: normalizeNullableText(value.paymentTerms ?? value.invoicePaymentTerms) || DEFAULT_COMPANY_PROFILE.paymentTerms,
        };
    } catch {
        return DEFAULT_COMPANY_PROFILE;
    }
};

const getChiefAccountant = async (): Promise<StatementActor | null> => {
    const res = await query(
        `
        SELECT "фио" AS fio, "должность" AS position
        FROM public."Сотрудники"
        WHERE COALESCE("активен", true) = true
          AND (
              BTRIM(COALESCE("должность", '')) = 'Главный бухгалтер'
              OR BTRIM(COALESCE("должность", '')) = 'главный бухгалтер'
              OR COALESCE("должность", '') LIKE '%Главный бухгалтер%'
              OR COALESCE("должность", '') LIKE '%главный бухгалтер%'
          )
        ORDER BY
            CASE
                WHEN BTRIM(COALESCE("должность", '')) = 'Главный бухгалтер' THEN 0
                WHEN BTRIM(COALESCE("должность", '')) = 'главный бухгалтер' THEN 1
                ELSE 1
            END,
            id ASC
        LIMIT 1
        `
    );

    const row = res.rows?.[0];

    if (!row?.fio) return null;
    return {
        fio: String(row.fio),
        position: row.position == null ? null : String(row.position),
    };
};

const getDirector = async (): Promise<StatementActor | null> => {
    const res = await query(
        `
        SELECT "фио" AS fio, "должность" AS position
        FROM public."Сотрудники"
        WHERE COALESCE("активен", true) = true
          AND (
              COALESCE("должность", '') LIKE '%директор%'
              OR COALESCE("должность", '') LIKE '%Директор%'
          )
        ORDER BY
            CASE
                WHEN COALESCE("должность", '') LIKE '%Генеральный директор%' THEN 0
                WHEN COALESCE("должность", '') LIKE '%генеральный директор%' THEN 1
                WHEN COALESCE("должность", '') LIKE '%Главный директор%' THEN 2
                WHEN COALESCE("должность", '') LIKE '%главный директор%' THEN 3
                ELSE 4
            END,
            id ASC
        LIMIT 1
        `
    );

    const row = res.rows?.[0];
    if (!row?.fio) return null;
    return {
        fio: String(row.fio),
        position: row.position == null ? null : String(row.position),
    };
};

const getPrimarySupplierBankAccount = async (supplierId: number): Promise<SupplierBankAccount | null> => {
    const res = await query(
        `
        SELECT *
        FROM public."Расчетные_счета_поставщиков"
        WHERE "поставщик_id" = $1
        ORDER BY COALESCE("основной", false) DESC, sort_order ASC, id ASC
        LIMIT 1
        `,
        [supplierId]
    );

    const row = res.rows?.[0];
    if (!row) return null;
    return {
        id: Number(row.id),
        name: normalizeNullableText(row.название),
        bik: normalizeNullableText(row.бик) || null,
        bankName: normalizeNullableText(row.банк) || null,
        correspondentAccount: normalizeNullableText(row.к_с) || null,
        settlementAccount: normalizeNullableText(row.р_с) || null,
        isPrimary: Boolean(row.основной),
        sortOrder: Number(row.sort_order) || 0,
    };
};

const getPurchaseDocumentData = async (
    purchaseId: number
): Promise<{ purchase: PurchaseDocumentRow; positions: PurchaseDocumentPosition[] }> => {
    const purchaseRes = await query(
        `
        SELECT
            p.id,
            p."дата_заказа",
            p."дата_поступления",
            p."поставщик_id",
            COALESCE(p."использовать_доставку", false) AS использовать_доставку,
            p."стоимость_доставки",
            tc."название" AS транспорт_название,
            s."название" AS поставщик_название,
            s."тип" AS поставщик_тип,
            s."краткое_название" AS поставщик_краткое_название,
            s."полное_название" AS поставщик_полное_название,
            s."фамилия" AS поставщик_фамилия,
            s."имя" AS поставщик_имя,
            s."отчество" AS поставщик_отчество,
            s."инн" AS поставщик_инн,
            s."кпп" AS поставщик_кпп,
            s."окпо" AS поставщик_окпо,
            COALESCE(s."адрес_печати", s."адрес_регистрации") AS поставщик_адрес,
            s."адрес_регистрации" AS поставщик_адрес_регистрации,
            s."адрес_печати" AS поставщик_адрес_печати,
            s."email" AS поставщик_email,
            s."телефон" AS поставщик_телефон
        FROM public."Закупки" p
        LEFT JOIN public."Поставщики" s ON s.id = p."поставщик_id"
        LEFT JOIN public."Транспортные_компании" tc ON tc.id = p."транспорт_id"
        WHERE p.id = $1
        LIMIT 1
        `,
        [purchaseId]
    );

    const purchase = purchaseRes.rows?.[0] as PurchaseDocumentRow | undefined;
    if (!purchase) {
        throw new Error('Закупка не найдена');
    }

    const positionsRes = await query(
        `
        SELECT
            pz.id,
            t."название" AS товар_название,
            t."артикул" AS товар_артикул,
            t."единица_измерения" AS товар_единица_измерения,
            t."тип_номенклатуры" AS товар_тип_номенклатуры,
            COALESCE(pz."количество", 0)::numeric AS количество,
            COALESCE(pz."цена", 0)::numeric AS цена,
            (
                COALESCE(pz."количество", 0)
                * COALESCE(pz."цена", 0)
            )::numeric AS сумма_без_ндс,
            (
                COALESCE(pz."количество", 0)
                * COALESCE(pz."цена", 0)
                * COALESCE(v."ставка", 0)
                / 100.0
            )::numeric AS сумма_ндс,
            (
                COALESCE(pz."количество", 0)
                * COALESCE(pz."цена", 0)
                * (1 + COALESCE(v."ставка", 0) / 100.0)
            )::numeric AS сумма_всего,
            COALESCE(v."ставка", 0)::numeric AS ндс_ставка
        FROM public."Позиции_закупки" pz
        LEFT JOIN public."Товары" t ON t.id = pz."товар_id"
        LEFT JOIN public."Ставки_НДС" v ON v.id = pz."ндс_id"
        WHERE pz."закупка_id" = $1
        ORDER BY pz.id ASC
        `,
        [purchaseId]
    );

    const positions = (positionsRes.rows || []).map((row: any): PurchaseDocumentPosition => ({
        id: Number(row.id),
        товар_название: normalizeNullableText(row.товар_название) || `Товар #${row.id}`,
        товар_артикул: normalizeNullableText(row.товар_артикул) || null,
        товар_единица_измерения: normalizeNullableText(row.товар_единица_измерения) || 'шт',
        товар_тип_номенклатуры: normalizeNullableText(row.товар_тип_номенклатуры) || null,
        количество: Number(row.количество) || 0,
        цена: Number(row.цена) || 0,
        сумма_без_ндс: Number(row.сумма_без_ндс) || 0,
        сумма_ндс: Number(row.сумма_ндс) || 0,
        сумма_всего: Number(row.сумма_всего) || 0,
        ндс_ставка: Number(row.ндс_ставка) || 0,
    }));

    return { purchase, positions };
};

const excelCell = (
    sheetName: string,
    address: string,
    value: string | number,
    wrapText = false
): RenderXlsxTemplateParams['cells'][number] => ({
    sheetName,
    address,
    value,
    style: wrapText ? { wrapText: true, vertical: 'top' } : undefined,
});

const excelLeftCell = (
    sheetName: string,
    address: string,
    value: string | number,
    wrapText = false
): RenderXlsxTemplateParams['cells'][number] => ({
    sheetName,
    address,
    value,
    style: {
        horizontal: 'left',
        vertical: wrapText ? 'top' : 'center',
        ...(wrapText ? { wrapText: true } : {}),
    },
});

const clearCells = (sheetName: string, addresses: string[]): RenderXlsxTemplateParams['cells'] =>
    addresses.map((address) => excelCell(sheetName, address, ''));

const shiftCellAddress = (address: string, rowOffset: number): string =>
    address.replace(/([A-Z]+)(\d+)/, (_, column: string, row: string) => `${column}${Number(row) + rowOffset}`);

const getUnitCode = (unit: string | null | undefined): string => {
    const normalized = normalizeNullableText(unit).toLowerCase().replace(/\s+/g, '');
    return UNIT_CODE_MAP[normalized] ?? '';
};

const buildCompanyBlock = (profile: CompanyProfile): string =>
    [
        profile.legalName || profile.displayName,
        profile.documentAddress || profile.legalAddress,
        [profile.inn && `ИНН ${profile.inn}`, profile.kpp && `КПП ${profile.kpp}`].filter(Boolean).join(', '),
        [profile.phone && `тел. ${profile.phone}`, profile.email].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n');

const buildSupplierBlock = (
    purchase: PurchaseDocumentRow,
    supplierBankAccount: SupplierBankAccount | null
): string => {
    const supplierName = buildSupplierDisplayName({
        название: purchase.поставщик_название,
        тип: purchase.поставщик_тип,
        краткоеНазвание: purchase.поставщик_краткое_название,
        полноеНазвание: purchase.поставщик_полное_название,
        фамилия: purchase.поставщик_фамилия,
        имя: purchase.поставщик_имя,
        отчество: purchase.поставщик_отчество,
    });
    const supplierAddress = buildSupplierPrimaryAddress({
        адрес: purchase.поставщик_адрес,
        адресРегистрации: purchase.поставщик_адрес_регистрации,
        адресПечати: purchase.поставщик_адрес_печати,
    }) || '';

    return [
        supplierName,
        supplierAddress,
        [
            purchase.поставщик_инн && `ИНН ${purchase.поставщик_инн}`,
            purchase.поставщик_кпп && `КПП ${purchase.поставщик_кпп}`,
        ].filter(Boolean).join(', '),
        [
            purchase.поставщик_телефон && `тел. ${purchase.поставщик_телефон}`,
            purchase.поставщик_email,
        ].filter(Boolean).join(', '),
        supplierBankAccount?.bankName || '',
    ].filter(Boolean).join('\n');
};

const buildTransportSummary = (purchase: PurchaseDocumentRow): string => {
    if (!purchase.использовать_доставку) return 'Самовывоз';

    return [
        purchase.транспорт_название || 'Доставка поставщика',
        purchase.стоимость_доставки != null ? `стоимость доставки ${formatMoney(purchase.стоимость_доставки)} руб.` : '',
    ].filter(Boolean).join(', ');
};

const buildCompanyTorgName = (profile: CompanyProfile): string =>
    profile.legalName || profile.displayName;

const buildCompanyTorgLine = (profile: CompanyProfile): string =>
    [
        buildCompanyTorgName(profile),
        profile.documentAddress || profile.legalAddress,
        profile.phone && `тел. ${profile.phone}`,
        [profile.inn && `ИНН ${profile.inn}`, profile.kpp && `КПП ${profile.kpp}`].filter(Boolean).join(', '),
        [
            profile.settlementAccount && `р/с ${profile.settlementAccount}`,
            profile.bankName && `в ${profile.bankName}`,
            profile.correspondentAccount && `к/с ${profile.correspondentAccount}`,
            profile.bik && `БИК ${profile.bik}`,
        ].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ');

const buildSupplierTorgName = (purchase: PurchaseDocumentRow): string =>
    normalizeSupplierContragentType(purchase.поставщик_тип) === 'Организация'
        ? normalizeNullableText(purchase.поставщик_полное_название)
        || normalizeNullableText(purchase.поставщик_краткое_название)
        || normalizeNullableText(purchase.поставщик_название)
        : buildSupplierDisplayName({
            название: purchase.поставщик_название,
            тип: purchase.поставщик_тип,
            краткоеНазвание: purchase.поставщик_краткое_название,
            полноеНазвание: purchase.поставщик_полное_название,
            фамилия: purchase.поставщик_фамилия,
            имя: purchase.поставщик_имя,
            отчество: purchase.поставщик_отчество,
        });

const buildSupplierTorgLine = (
    purchase: PurchaseDocumentRow,
    supplierBankAccount: SupplierBankAccount | null
): string => {
    const supplierName = buildSupplierTorgName(purchase);
    const supplierAddress = buildSupplierPrimaryAddress({
        адрес: purchase.поставщик_адрес,
        адресРегистрации: purchase.поставщик_адрес_регистрации,
        адресПечати: purchase.поставщик_адрес_печати,
    }) || '';

    return [
        supplierName,
        supplierAddress,
        purchase.поставщик_телефон && `тел. ${purchase.поставщик_телефон}`,
        [purchase.поставщик_инн && `ИНН ${purchase.поставщик_инн}`, purchase.поставщик_кпп && `КПП ${purchase.поставщик_кпп}`].filter(Boolean).join(', '),
        [
            supplierBankAccount?.settlementAccount && `р/с ${supplierBankAccount.settlementAccount}`,
            supplierBankAccount?.bankName && `в ${supplierBankAccount.bankName}`,
            supplierBankAccount?.correspondentAccount && `к/с ${supplierBankAccount.correspondentAccount}`,
            supplierBankAccount?.bik && `БИК ${supplierBankAccount.bik}`,
        ].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ');
};

const numToWordsRuGenitive = (value: number): string => {
    const forms: Record<number, string> = {
        0: 'нуля',
        1: 'одного',
        2: 'двух',
        3: 'трех',
        4: 'четырех',
        5: 'пяти',
        6: 'шести',
        7: 'семи',
        8: 'восьми',
        9: 'девяти',
        10: 'десяти',
        11: 'одиннадцати',
        12: 'двенадцати',
        13: 'тринадцати',
        14: 'четырнадцати',
        15: 'пятнадцати',
        16: 'шестнадцати',
        17: 'семнадцати',
        18: 'восемнадцати',
        19: 'девятнадцати',
        20: 'двадцати',
    };
    if (value in forms) return forms[value];
    return numToWordsRu(value, false);
};

const buildPurchaseInvoicePayload = async (purchaseId: number): Promise<PurchaseDocumentRenderPayload> => {
    const definition = getPurchaseDocumentDefinition('purchase_invoice');
    const { purchase, positions } = await getPurchaseDocumentData(purchaseId);

    const availableDocuments = getAvailablePurchaseDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
    });

    if (!availableDocuments.some((item) => item.key === 'purchase_invoice')) {
        throw new Error('Документ недоступен для состава этой закупки');
    }

    const [template, companyProfile, director, supplierBankAccount] = await Promise.all([
        getDocumentTemplateDefinition('purchase_invoice'),
        getCompanyProfile(),
        getDirector(),
        getPrimarySupplierBankAccount(purchase.поставщик_id),
    ]);

    const documentDate = new Date();
    const purchaseDate = parseDateOnly(purchase.дата_заказа);
    const supplierName = buildSupplierDisplayName({
        название: purchase.поставщик_название,
        тип: purchase.поставщик_тип,
        краткоеНазвание: purchase.поставщик_краткое_название,
        полноеНазвание: purchase.поставщик_полное_название,
        фамилия: purchase.поставщик_фамилия,
        имя: purchase.поставщик_имя,
        отчество: purchase.поставщик_отчество,
    });
    const supplierAddress = buildSupplierPrimaryAddress({
        адрес: purchase.поставщик_адрес,
        адресРегистрации: purchase.поставщик_адрес_регистрации,
        адресПечати: purchase.поставщик_адрес_печати,
    }) || '';
    const totalAmount = positions.reduce((sum, position) => sum + position.сумма_всего, 0);
    const totalVat = positions.reduce((sum, position) => sum + position.сумма_ндс, 0);
    const basis = buildPurchaseBasis(purchase.id, purchaseDate);
    const itemsBlock = buildPurchaseItemsBlock(positions);
    const invoiceStructuredRows = buildPurchaseInvoiceStructuredRows(positions);
    const directorFio = companyProfile.directorName || director?.fio || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';
    const supplierType = normalizeSupplierContragentType(purchase.поставщик_тип);
    const supplierPosition = supplierType === 'Организация'
        ? 'Генеральный директор'
        : supplierType === 'Индивидуальный предприниматель'
            ? 'Индивидуальный предприниматель'
            : '';
    const supplierSignatoryFio = supplierType === 'Организация' ? '' : supplierName;
    const supplierContacts = [
        normalizeNullableText(purchase.поставщик_телефон) && `Телефон: ${normalizeNullableText(purchase.поставщик_телефон)}`,
        normalizeNullableText(purchase.поставщик_email) && `Эл. почта: ${normalizeNullableText(purchase.поставщик_email)}`,
    ].filter(Boolean);
    const buyerLineParts = [
        companyProfile.displayName,
        companyProfile.inn && `ИНН: ${companyProfile.inn}`,
        companyProfile.kpp && `КПП: ${companyProfile.kpp}`,
    ].filter(Boolean);
    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, purchase.id),
        replacements: {
            '{НомерДокумента}': String(purchase.id),
            '{ДатаДокумента}': formatDateRuNumeric(documentDate),
            '{ГородДокумента}': companyProfile.city,
            '{НазваниеОрганизации}': supplierName,
            '{ЮридическийАдрес}': supplierAddress,
            '{АдресДляДокументов}': supplierAddress,
            '{ИНН}': normalizeNullableText(purchase.поставщик_инн),
            '{КПП}': normalizeNullableText(purchase.поставщик_кпп),
            '{НаименованиеБанка}': normalizeNullableText(supplierBankAccount?.bankName),
            '{БИК}': normalizeNullableText(supplierBankAccount?.bik),
            '{КоррСчет}': normalizeNullableText(supplierBankAccount?.correspondentAccount),
            '{РасчетныйСчет}': normalizeNullableText(supplierBankAccount?.settlementAccount),
            '{ПочтаДляДокументов}': normalizeNullableText(purchase.поставщик_email),
            '{Телефон}': normalizeNullableText(purchase.поставщик_телефон),
            '{ВЛице}': '',
            '{ДолжностьРуководителя}': '',
            '{ФИОДляПодписи}': '',
            '{ФИОБухгалтераДляПодписи}': '',
            '{ДолжностьИсполнителя}': '',
            '{ФИОИсполнителяДляПодписи}': '',
            '{НазваниеКонтр}': companyProfile.displayName,
            '{АдресКонтр}': companyProfile.documentAddress || companyProfile.legalAddress,
            '{ИННКонтр}': companyProfile.inn,
            '{КППКонтр}': companyProfile.kpp,
            '{НаименованиеБанкаКонтр}': companyProfile.bankName,
            '{БИКБанкаКонтр}': companyProfile.bik,
            '{КоррСчетКонтр}': companyProfile.correspondentAccount,
            '{РасчетныйСчетКонтр}': companyProfile.settlementAccount,
            '{ПочтаКонтрДляДокументов}': companyProfile.email,
            '{ТелефонКонтр}': companyProfile.phone,
            '{ДолжностьКонтр}': directorPosition,
            '{ФИОКонтрДляПодписи}': directorFio,
            '{Основание}': basis,
            '{КоличествоПозиций}': String(positions.length),
            '{ФактурнаяЧасть}': itemsBlock,
            '{СуммаДокументаВСЕГО}': formatMoney(totalAmount),
            '{СуммаДокументаПрописью}': amountToWordsRub(totalAmount),
            '{СуммаНДСПрописью}': totalVat > 0 ? amountToWordsRub(totalVat) : 'без НДС',
            '{60ОтСуммыДокумента}': formatMoney(totalAmount * 0.6),
            '{40ОтСуммыДокумента}': formatMoney(totalAmount * 0.4),
            '{УсловияОплаты}': companyProfile.paymentTerms,
            '__ALT_INVOICE_COMPANY_NAME__': supplierName,
            '__ALT_INVOICE_COMPANY_ADDRESS__': supplierAddress,
            '__ALT_INVOICE_COMPANY_CONTACTS__': supplierContacts.join('\n'),
            '__ALT_INVOICE_BANK_NAME__': normalizeNullableText(supplierBankAccount?.bankName),
            '__ALT_INVOICE_BIK__': normalizeNullableText(supplierBankAccount?.bik),
            '__ALT_INVOICE_CORR_ACCOUNT__': normalizeNullableText(supplierBankAccount?.correspondentAccount),
            '__ALT_INVOICE_INN__': normalizeNullableText(purchase.поставщик_инн),
            '__ALT_INVOICE_KPP__': normalizeNullableText(purchase.поставщик_кпп),
            '__ALT_INVOICE_SETTLEMENT_ACCOUNT__': normalizeNullableText(supplierBankAccount?.settlementAccount),
            '__ALT_INVOICE_RECIPIENT__': supplierName,
            '__ALT_INVOICE_TITLE__': `Счёт № ${purchase.id} от ${formatDateRuNumeric(documentDate)}`,
            '__ALT_INVOICE_SUPPLIER_NAME__': supplierName,
            '__ALT_INVOICE_BUYER_TEXT__': buyerLineParts.join(', '),
            '__ALT_INVOICE_ROWS_JSON__': JSON.stringify(invoiceStructuredRows),
            '__ALT_INVOICE_TOTAL_LINE__': `Итого к оплате: ${formatMoney(totalAmount)}\nВ том числе НДС: ${totalVat > 0 ? formatMoney(totalVat) : 'Без НДС'}`,
            '__ALT_INVOICE_TOTAL_WORDS__': `Всего к оплате: ${amountToWordsRub(totalAmount)}, ${totalVat > 0 ? `в том числе НДС ${formatMoney(totalVat)} руб.` : 'без НДС.'}`,
            '__ALT_INVOICE_SIGN_LABEL__': 'Поставщик',
            '__ALT_INVOICE_SIGN_POSITION__': supplierPosition,
            '__ALT_INVOICE_SIGN_FIO__': supplierSignatoryFio,
        },
        pdfPostprocess: 'none',
    };
};

const buildPurchaseUpdPayload = async (
    purchaseId: number,
    documentKey: Extract<PurchaseDocumentKey, 'purchase_upd_status_1' | 'purchase_upd_status_2'>
): Promise<PurchaseDocumentRenderPayload> => {
    const definition = getPurchaseDocumentDefinition(documentKey);
    const { purchase, positions } = await getPurchaseDocumentData(purchaseId);

    const availableDocuments = getAvailablePurchaseDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
    });

    if (!availableDocuments.some((item) => item.key === documentKey)) {
        throw new Error('Документ недоступен для состава этой закупки');
    }

    if (positions.length === 0) {
        throw new Error('В закупке нет позиций для формирования документа');
    }

    const [template, companyProfile, director, accountant] = await Promise.all([
        getDocumentTemplateDefinition(documentKey),
        getCompanyProfile(),
        getDirector(),
        getChiefAccountant(),
    ]);

    const sourceSheetName = 'стр.1';
    const targetSheetName = 'Документ';
    const purchaseDate = parseDateOnly(purchase.дата_заказа);
    const dateStringLong = formatDateRuLong(purchaseDate);
    const basis = buildPurchaseBasis(purchase.id, purchaseDate);
    const supplierName = buildSupplierDisplayName({
        название: purchase.поставщик_название,
        тип: purchase.поставщик_тип,
        краткоеНазвание: purchase.поставщик_краткое_название,
        полноеНазвание: purchase.поставщик_полное_название,
        фамилия: purchase.поставщик_фамилия,
        имя: purchase.поставщик_имя,
        отчество: purchase.поставщик_отчество,
    });
    const supplierAddress = buildSupplierPrimaryAddress({
        адрес: purchase.поставщик_адрес,
        адресРегистрации: purchase.поставщик_адрес_регистрации,
        адресПечати: purchase.поставщик_адрес_печати,
    }) || '';
    const footerStartRow = 22 + (positions.length * 3);
    const footerEndRow = footerStartRow + 30;
    const totalNet = positions.reduce((sum, position) => sum + position.сумма_без_ндс, 0);
    const totalTax = positions.reduce((sum, position) => sum + position.сумма_ндс, 0);
    const totalAmount = positions.reduce((sum, position) => sum + position.сумма_всего, 0);
    const year = String(purchaseDate.getUTCFullYear());
    const receiptDate = parseDateOnly(purchase.дата_поступления || purchase.дата_заказа);
    const directorName = director?.fio || companyProfile.directorName || '';
    const accountantName = accountant?.fio || companyProfile.accountantName || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';
    const directorShortName = toShortFio(directorName);
    const accountantShortName = toShortFio(accountantName);
    const supplierType = normalizeSupplierContragentType(purchase.поставщик_тип);
    const footerRowOffset = footerStartRow - 31;
    const footerCell = (address: string, value: string | number, wrapText = false) =>
        excelCell(targetSheetName, shiftCellAddress(address, footerRowOffset), value, wrapText);

    const cells: RenderXlsxTemplateParams['cells'] = [
        excelCell(targetSheetName, 'AM1', purchase.id),
        excelCell(targetSheetName, 'BD1', dateStringLong),
        excelCell(targetSheetName, 'I6', documentKey === 'purchase_upd_status_1' ? 1 : 2),
        excelCell(targetSheetName, 'BA4', supplierName, true),
        excelCell(targetSheetName, 'BA5', supplierAddress, true),
        excelCell(
            targetSheetName,
            'BA6',
            [purchase.поставщик_инн, purchase.поставщик_кпп].filter(Boolean).join('/') || ''
        ),
        excelCell(targetSheetName, 'BA7', supplierName === '' ? '' : `${supplierName}${supplierAddress ? `, ${supplierAddress}` : ''}`, true),
        excelCell(targetSheetName, 'BA8', `${companyProfile.legalName}, ${companyProfile.documentAddress || companyProfile.legalAddress}`, true),
        excelCell(targetSheetName, 'BE10', ''),
        excelCell(targetSheetName, 'CJ10', ''),
        excelCell(targetSheetName, 'BA11', companyProfile.legalName, true),
        excelCell(targetSheetName, 'BA12', companyProfile.documentAddress || companyProfile.legalAddress, true),
        excelCell(targetSheetName, 'BA13', `${companyProfile.inn}/${companyProfile.kpp}`),
        excelCell(targetSheetName, 'BA14', 'российский рубль, 643'),
        footerCell('B35', positions.length),
        footerCell('CJ31', Number(totalNet.toFixed(2))),
        footerCell('DZ31', Number(totalAmount.toFixed(2))),
        footerCell('AZ33', ''),
        footerCell('BO33', directorShortName),
        footerCell('DQ33', ''),
        footerCell('EM34', accountantShortName),
        footerCell('AR40', basis, true),
        footerCell('AF42', buildTransportSummary(purchase), true),
        footerCell('B45', supplierType === 'Индивидуальный предприниматель' ? 'Индивидуальный предприниматель' : ''),
        footerCell('AA45', ''),
        footerCell('BA45', supplierType === 'Индивидуальный предприниматель' || supplierType === 'Физическое лицо' ? supplierName : ''),
        footerCell('CK45', directorName ? directorPosition : ''),
        footerCell('DK45', ''),
        footerCell('EI45', directorName),
        footerCell('AI47', String(purchaseDate.getUTCDate()).padStart(2, '0')),
        footerCell('AO47', getMonthRuGenitive(purchaseDate)),
        footerCell('BN47', year.slice(0, 2)),
        footerCell('BR47', year.slice(2)),
        footerCell('DS47', String(receiptDate.getUTCDate()).padStart(2, '0')),
        footerCell('DY47', getMonthRuGenitive(receiptDate)),
        footerCell('EV47', String(receiptDate.getUTCFullYear()).slice(0, 2)),
        footerCell('EZ47', String(receiptDate.getUTCFullYear()).slice(2)),
        footerCell('B49', ''),
        footerCell('CK49', ''),
        footerCell('B52', supplierType === 'Индивидуальный предприниматель' ? 'Индивидуальный предприниматель' : ''),
        footerCell('AA52', ''),
        footerCell('BA52', supplierType === 'Индивидуальный предприниматель' || supplierType === 'Физическое лицо' ? supplierName : ''),
        footerCell('CK52', directorName ? directorPosition : ''),
        footerCell('DK52', ''),
        footerCell('EI52', directorName),
        footerCell('B55', supplierName),
        footerCell('CK55', companyProfile.legalName),
    ];

    if (documentKey === 'purchase_upd_status_1') {
        cells.push(footerCell('DM31', Number(totalTax.toFixed(2))));
    } else {
        cells.push(footerCell('DM31', ''));
    }

    positions.forEach((position, index) => {
        const row = 22 + (index * 3);
        const taxRateValue = position.ндс_ставка > 0
            ? Number((position.ндс_ставка / 100).toFixed(4))
            : '';
        cells.push(
            excelCell(targetSheetName, `A${row}`, index + 1),
            excelCell(targetSheetName, `G${row}`, position.товар_артикул || String(position.id)),
            excelCell(targetSheetName, `T${row}`, position.товар_название, true),
            excelCell(targetSheetName, `BA${row}`, getUnitCode(position.товар_единица_измерения)),
            excelCell(targetSheetName, `BG${row}`, position.товар_единица_измерения || 'шт'),
            excelCell(targetSheetName, `BP${row}`, Number(position.количество.toFixed(3))),
            excelCell(targetSheetName, `BY${row}`, Number(position.цена.toFixed(2))),
            excelCell(targetSheetName, `CJ${row}`, Number(position.сумма_без_ндс.toFixed(2))),
            excelCell(targetSheetName, `CY${row}`, 'Без акциза'),
            excelCell(targetSheetName, `DZ${row}`, Number(position.сумма_всего.toFixed(2))),
            excelCell(targetSheetName, `EO${row}`, ''),
            excelCell(targetSheetName, `EU${row}`, ''),
            excelCell(targetSheetName, `FF${row}`, ''),
        );

        if (documentKey === 'purchase_upd_status_1') {
            cells.push(
                excelCell(targetSheetName, `DF${row}`, taxRateValue),
                excelCell(targetSheetName, `DM${row}`, Number(position.сумма_ндс.toFixed(2))),
            );
        } else {
            cells.push(
                excelCell(targetSheetName, `DF${row}`, ''),
                excelCell(targetSheetName, `DM${row}`, ''),
            );
        }
    });

    const rangeCopies: RenderXlsxTemplateParams['rangeCopies'] = [];
    for (let index = 3; index < positions.length; index += 1) {
        rangeCopies.push({
            sourceSheetName,
            sourceRange: 'A25:HB27',
            targetSheetName,
            targetStartAddress: `A${22 + (index * 3)}`,
        });
    }

    if (positions.length !== 3) {
        rangeCopies.push({
            sourceSheetName,
            sourceRange: 'A31:HB61',
            targetSheetName,
            targetStartAddress: `A${footerStartRow}`,
        });
    }

    const rowVisibility: RenderXlsxTemplateParams['rowVisibility'] = [];
    if (footerEndRow < 61) {
        for (let row = footerEndRow + 1; row <= 61; row += 1) {
            rowVisibility.push({
                sheetName: targetSheetName,
                row,
                hidden: true,
            });
        }
    }

    cells.push(
        ...clearCells(targetSheetName, [
            shiftCellAddress('AZ35', footerRowOffset),
            shiftCellAddress('DQ35', footerRowOffset),
            shiftCellAddress('AZ38', footerRowOffset),
            shiftCellAddress('BO38', footerRowOffset),
            shiftCellAddress('AA45', footerRowOffset),
            shiftCellAddress('DK45', footerRowOffset),
            shiftCellAddress('AA52', footerRowOffset),
            shiftCellAddress('DK52', footerRowOffset),
            shiftCellAddress('CD49', footerRowOffset),
        ])
    );

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, purchase.id),
        cells,
        rowVisibility,
        rangeCopies,
        sheetCopies: [{
            sourceSheetName,
            targetSheetName,
        }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{
            sheetName: targetSheetName,
            range: `A1:HB${Math.max(61, footerEndRow)}`,
        }],
        sheetPageSetup: [{
            sheetName: targetSheetName,
            fitToWidth: 1,
            fitToHeight: 0,
        }],
        pdfPostprocess: 'none',
    };
};

const buildPurchaseTorg12Payload = async (purchaseId: number): Promise<PurchaseDocumentRenderPayload> => {
    const definition = getPurchaseDocumentDefinition('purchase_torg_12');
    const { purchase, positions } = await getPurchaseDocumentData(purchaseId);

    const availableDocuments = getAvailablePurchaseDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
    });

    if (!availableDocuments.some((item) => item.key === 'purchase_torg_12')) {
        throw new Error('Документ недоступен для состава этой закупки');
    }

    if (positions.length === 0) {
        throw new Error('В закупке нет позиций для формирования документа');
    }

    if (positions.length > TORG_ITEM_ROWS.length) {
        throw new Error(`ТОРГ-12 пока поддерживает не больше ${TORG_ITEM_ROWS.length} позиций в одном документе`);
    }

    const [template, companyProfile, supplierBankAccount, director, chiefAccountant] = await Promise.all([
        getDocumentTemplateDefinition('purchase_torg_12'),
        getCompanyProfile(),
        getPrimarySupplierBankAccount(purchase.поставщик_id),
        getDirector(),
        getChiefAccountant(),
    ]);

    const sourceSheetName = 'стр1';
    const targetSheetName = 'Документ';
    const purchaseDate = parseDateOnly(purchase.дата_заказа);
    const receiptDate = parseDateOnly(purchase.дата_поступления || purchase.дата_заказа);
    const issueDate = parseDateOnly(new Date().toISOString());
    const issueDateParts = formatDateRuParts(issueDate);
    const supplierLine = buildSupplierTorgLine(purchase, supplierBankAccount);
    const companyLine = buildCompanyTorgLine(companyProfile);
    const totalNet = positions.reduce((sum, position) => sum + position.сумма_без_ндс, 0);
    const totalTax = positions.reduce((sum, position) => sum + position.сумма_ндс, 0);
    const totalAmount = positions.reduce((sum, position) => sum + position.сумма_всего, 0);
    const totalQty = positions.reduce((sum, position) => sum + position.количество, 0);
    const firstPagePositions = positions.slice(0, 12);
    const secondPagePositions = positions.slice(12);
    const directorName = director?.fio || companyProfile.directorName || '';
    const directorPosition = director?.position || companyProfile.directorPosition || '';
    const chiefAccountantName = chiefAccountant?.fio || companyProfile.accountantName || '';
    const directorShortName = toShortFio(directorName);
    const chiefAccountantShortName = toShortFio(chiefAccountantName);
    const totalAmountRubles = Math.floor(totalAmount + 1e-9);
    const totalAmountKopecks = Math.round((totalAmount - totalAmountRubles) * 100);
    const pageCount = 2;
    const pageCountWords = numToWordsRuGenitive(pageCount);
    const recordsCountWords = numToWordsRu(positions.length, false);
    const totalPlacesWords = numToWordsRu(positions.length, false);

    const sumBy = (
        rows: PurchaseDocumentPosition[],
        getter: (position: PurchaseDocumentPosition) => number
    ) => rows.reduce((sum, position) => sum + getter(position), 0);

    const rowVisibility: RenderXlsxTemplateParams['rowVisibility'] = [];
    TORG_FIRST_PAGE_ITEM_ROWS.slice(firstPagePositions.length).forEach((row) => {
        rowVisibility.push({ sheetName: targetSheetName, row, hidden: true });
    });
    if (secondPagePositions.length === 0) {
        for (let row = 43; row <= 64; row += 1) {
            rowVisibility.push({ sheetName: targetSheetName, row, hidden: true });
        }
    } else {
        TORG_SECOND_PAGE_ITEM_ROWS.slice(secondPagePositions.length).forEach((row) => {
            rowVisibility.push({ sheetName: targetSheetName, row, hidden: true });
        });
    }
    const rowBreaks: RenderXlsxTemplateParams['rowBreaks'] = [{
        sheetName: targetSheetName,
        clearExisting: true,
        breaks: [secondPagePositions.length > 0 ? TORG_FIRST_PAGE_BREAK_ROW : TORG_FOOTER_PAGE_BREAK_ROW],
    }];

    const cells: RenderXlsxTemplateParams['cells'] = [
        ...clearCells(targetSheetName, ['AN70', 'AN71', 'AN72', 'AN73']),
        excelCell(targetSheetName, 'A7', supplierLine, true),
        excelCell(targetSheetName, 'A9', 'главный офис', true),

        excelCell(targetSheetName, 'L12', companyLine, true),
        excelCell(targetSheetName, 'I14', supplierLine, true),
        excelCell(targetSheetName, 'I16', companyLine, true),
        excelCell(targetSheetName, 'I18', 'Закупка', true),
        excelCell(targetSheetName, 'CF7', purchase.поставщик_окпо || ''),
        excelCell(targetSheetName, 'CF10', TORG_ACTIVITY_CODE),
        excelCell(targetSheetName, 'CF12', companyProfile.okpo),
        excelCell(targetSheetName, 'CF13', purchase.поставщик_окпо || ''),
        excelCell(targetSheetName, 'CF15', companyProfile.okpo),
        excelCell(targetSheetName, 'CF23', 'Поступление товаров'),
        excelCell(targetSheetName, 'AX26', purchase.id),
        excelCell(targetSheetName, 'BI26', formatDateRuNumeric(receiptDate)),
        excelCell(targetSheetName, 'CF17', purchase.id),
        excelCell(targetSheetName, 'CF19', formatDateRuNumeric(purchaseDate)),
        excelCell(targetSheetName, 'CF21', purchase.использовать_доставку ? purchase.id : ''),
        excelCell(targetSheetName, 'CF22', purchase.использовать_доставку ? formatDateRuNumeric(receiptDate) : ''),
        excelCell(targetSheetName, 'BB42', Number(sumBy(firstPagePositions, (position) => position.количество).toFixed(3))),
        excelCell(targetSheetName, 'BQ42', Number(sumBy(firstPagePositions, (position) => position.сумма_без_ндс).toFixed(2))),
        excelCell(targetSheetName, 'CB42', Number(sumBy(firstPagePositions, (position) => position.сумма_ндс).toFixed(2))),
        excelCell(targetSheetName, 'CI42', Number(sumBy(firstPagePositions, (position) => position.сумма_всего).toFixed(2))),
        excelCell(targetSheetName, 'BB62', Number(sumBy(secondPagePositions, (position) => position.количество).toFixed(3))),
        excelCell(targetSheetName, 'BQ62', Number(sumBy(secondPagePositions, (position) => position.сумма_без_ндс).toFixed(2))),
        excelCell(targetSheetName, 'CB62', Number(sumBy(secondPagePositions, (position) => position.сумма_ндс).toFixed(2))),
        excelCell(targetSheetName, 'CI62', Number(sumBy(secondPagePositions, (position) => position.сумма_всего).toFixed(2))),
        excelCell(targetSheetName, 'BB63', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'BQ63', Number(totalNet.toFixed(2))),
        excelCell(targetSheetName, 'CB63', Number(totalTax.toFixed(2))),
        excelCell(targetSheetName, 'CI63', Number(totalAmount.toFixed(2))),
        excelCell(targetSheetName, 'Y65', pageCountWords, true),
        excelCell(targetSheetName, 'K66', recordsCountWords, true),
        excelCell(targetSheetName, 'K72', totalPlacesWords, true),
        excelCell(targetSheetName, 'AN70', ''),
        excelCell(targetSheetName, 'AN71', ''),
        excelCell(targetSheetName, 'AN72', ''),
        excelCell(targetSheetName, 'AN73', ''),
        excelCell(targetSheetName, 'N77', amountToWordsRub(totalAmount), true),
        excelCell(targetSheetName, 'A79', totalAmountRubles),
        excelCell(targetSheetName, 'AM79', String(totalAmountKopecks).padStart(2, '0')),
        excelCell(targetSheetName, 'L81', directorPosition, true),
        excelCell(targetSheetName, 'AG81', directorShortName, true),
        excelCell(targetSheetName, 'AG83', chiefAccountantShortName, true),
        excelCell(targetSheetName, 'N88', issueDateParts.day),
        excelCell(targetSheetName, 'R88', issueDateParts.month),
        excelCell(targetSheetName, 'AA88', issueDateParts.year),
        excelCell(targetSheetName, 'BE88', issueDateParts.day),
        excelCell(targetSheetName, 'BI88', issueDateParts.month),
        excelCell(targetSheetName, 'BR88', issueDateParts.year),
    ];

    positions.forEach((position, index) => {
        const row = TORG_ITEM_ROWS[index];
        const vatRateLabel = position.ндс_ставка > 0 ? `${position.ндс_ставка}%` : 'без НДС';
        cells.push(
            excelCell(targetSheetName, `A${row}`, index + 1),
            excelLeftCell(targetSheetName, `D${row}`, position.товар_название, true),
            excelCell(targetSheetName, `T${row}`, position.товар_артикул || ''),
            excelCell(targetSheetName, `X${row}`, position.товар_единица_измерения || 'шт'),
            excelCell(targetSheetName, `AC${row}`, getUnitCode(position.товар_единица_измерения)),
            excelCell(targetSheetName, `AH${row}`, ''),
            excelCell(targetSheetName, `AM${row}`, ''),
            excelCell(targetSheetName, `AR${row}`, ''),
            excelCell(targetSheetName, `AW${row}`, ''),
            excelCell(targetSheetName, `BB${row}`, Number(position.количество.toFixed(3))),
            excelCell(targetSheetName, `BH${row}`, Number(position.цена.toFixed(2))),
            excelCell(targetSheetName, `BQ${row}`, Number(position.сумма_без_ндс.toFixed(2))),
            excelCell(targetSheetName, `BX${row}`, vatRateLabel),
            excelCell(targetSheetName, `CB${row}`, Number(position.сумма_ндс.toFixed(2))),
            excelCell(targetSheetName, `CI${row}`, Number(position.сумма_всего.toFixed(2))),
        );
    });

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, purchase.id),
        cells,
        rowVisibility,
        rowBreaks,
        sheetCopies: [{
            sourceSheetName,
            targetSheetName,
        }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{
            sheetName: targetSheetName,
            range: 'A1:CQ89',
        }],
        sheetPageSetup: [{
            sheetName: targetSheetName,
            fitToWidth: 1,
            fitToHeight: 0,
        }],
        pdfPostprocess: 'none',
    };
};

export const buildPurchaseDocumentPayload = async (
    purchaseId: number,
    documentKey: PurchaseDocumentKey
): Promise<PurchaseDocumentRenderPayload> => {
    if (documentKey === 'purchase_invoice') {
        return buildPurchaseInvoicePayload(purchaseId);
    }

    if (documentKey === 'purchase_torg_12') {
        return buildPurchaseTorg12Payload(purchaseId);
    }

    return buildPurchaseUpdPayload(purchaseId, documentKey);
};
