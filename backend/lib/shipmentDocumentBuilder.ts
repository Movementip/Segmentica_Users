import { query } from './db';
import { getDocumentTemplateDefinition, type DocumentTemplateDefinition } from './documentTemplates';
import type { RenderXlsxTemplateParams } from './documentRendererClient';
import {
    getAvailableShipmentDocumentDefinitions,
    getShipmentDocumentDefinition,
    type ShipmentDocumentKey,
} from './shipmentDocumentDefinitions';
import { buildClientDisplayName, buildClientPrimaryAddress, type ClientBankAccount } from './clientContragents';

type ShipmentDocumentRow = {
    id: number;
    дата_отгрузки: string;
    заявка_id: number | null;
    использовать_доставку: boolean;
    стоимость_доставки: number | null;
    транспорт_id: number | null;
    транспорт_название: string | null;
    транспорт_телефон: string | null;
    транспорт_email: string | null;
    заявка_дата_создания: string | null;
    клиент_id: number | null;
    клиент_название?: string | null;
    клиент_тип?: string | null;
    клиент_краткое_название?: string | null;
    клиент_полное_название?: string | null;
    клиент_фамилия?: string | null;
    клиент_имя?: string | null;
    клиент_отчество?: string | null;
    клиент_инн?: string | null;
    клиент_кпп?: string | null;
    клиент_окпо?: string | null;
    клиент_адрес?: string | null;
    клиент_адрес_регистрации?: string | null;
    клиент_адрес_печати?: string | null;
    клиент_email?: string | null;
    клиент_телефон?: string | null;
};

type ShipmentDocumentPosition = {
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
};

export type ShipmentDocumentRenderPayload = {
    documentTitle: string;
    template: DocumentTemplateDefinition;
    fileBaseName: string;
    cells: RenderXlsxTemplateParams['cells'];
    rowVisibility?: RenderXlsxTemplateParams['rowVisibility'];
    rowBreaks?: RenderXlsxTemplateParams['rowBreaks'];
    printAreas?: RenderXlsxTemplateParams['printAreas'];
    rangeCopies?: RenderXlsxTemplateParams['rangeCopies'];
    sheetCopies?: RenderXlsxTemplateParams['sheetCopies'];
    hiddenSheets?: RenderXlsxTemplateParams['hiddenSheets'];
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

const buildFileBaseName = (title: string, shipmentId: number): string =>
    `${title} Отгрузка ${shipmentId}`;

const buildShipmentBasis = (shipment: ShipmentDocumentRow, shipmentDate: Date): string => (
    shipment.заявка_id
        ? `Заявка № ${shipment.заявка_id} от ${formatDateRuNumeric(parseDateOnly(shipment.заявка_дата_создания || shipmentDate.toISOString()))}`
        : `Отгрузка № ${shipment.id} от ${formatDateRuNumeric(shipmentDate)}`
);

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

const getShipmentDocumentData = async (
    shipmentId: number
): Promise<{ shipment: ShipmentDocumentRow; positions: ShipmentDocumentPosition[] }> => {
    const shipmentRes = await query(
        `
        SELECT
            s.id,
            s."дата_отгрузки",
            s."заявка_id",
            COALESCE(s."использовать_доставку", true) AS использовать_доставку,
            s."стоимость_доставки",
            s."транспорт_id",
            z."дата_создания" AS заявка_дата_создания,
            t."название" AS транспорт_название,
            t."телефон" AS транспорт_телефон,
            t.email AS транспорт_email,
            k.id AS клиент_id,
            k."название" AS клиент_название,
            k."тип" AS клиент_тип,
            k."краткое_название" AS клиент_краткое_название,
            k."полное_название" AS клиент_полное_название,
            k."фамилия" AS клиент_фамилия,
            k."имя" AS клиент_имя,
            k."отчество" AS клиент_отчество,
            k."инн" AS клиент_инн,
            k."кпп" AS клиент_кпп,
            k."окпо" AS клиент_окпо,
            k."адрес" AS клиент_адрес,
            k."адрес_регистрации" AS клиент_адрес_регистрации,
            k."адрес_печати" AS клиент_адрес_печати,
            k.email AS клиент_email,
            k."телефон" AS клиент_телефон
        FROM public."Отгрузки" s
        LEFT JOIN public."Заявки" z ON z.id = s."заявка_id"
        LEFT JOIN public."Клиенты" k ON k.id = z."клиент_id"
        LEFT JOIN public."Транспортные_компании" t ON t.id = s."транспорт_id"
        WHERE s.id = $1
        LIMIT 1
        `,
        [shipmentId]
    );

    const shipment = shipmentRes.rows?.[0] as ShipmentDocumentRow | undefined;
    if (!shipment) {
        throw new Error('Отгрузка не найдена');
    }

    const positionsRes = await query(
        `
        SELECT
            sp.id,
            pr."название" AS товар_название,
            pr."артикул" AS товар_артикул,
            pr."единица_измерения" AS товар_единица_измерения,
            pr."тип_номенклатуры" AS товар_тип_номенклатуры,
            COALESCE(sp.quantity, 0)::numeric AS количество,
            COALESCE(sp.price, 0)::numeric AS цена,
            (COALESCE(sp.quantity, 0) * COALESCE(sp.price, 0))::numeric AS сумма_без_ндс,
            (
                COALESCE(sp.quantity, 0)
                * COALESCE(sp.price, 0)
                * COALESCE(v."ставка", 0)
                / 100.0
            )::numeric AS сумма_ндс,
            (
                COALESCE(sp.quantity, 0)
                * COALESCE(sp.price, 0)
                * (1 + COALESCE(v."ставка", 0) / 100.0)
            )::numeric AS сумма_всего,
            COALESCE(v."ставка", 0)::numeric AS ндс_ставка
        FROM public.shipment_positions sp
        LEFT JOIN public."Товары" pr ON pr.id = sp.product_id
        LEFT JOIN public."Ставки_НДС" v ON v.id = sp.vat_id
        WHERE sp.shipment_id = $1
        ORDER BY sp.id ASC
        `,
        [shipmentId]
    );

    const positions = (positionsRes.rows || []).map((row: any): ShipmentDocumentPosition => ({
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

    return { shipment, positions };
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

const buildCompanyTransportLine = (profile: CompanyProfile): string =>
    [
        profile.legalName || profile.displayName,
        profile.documentAddress || profile.legalAddress,
        [profile.inn && `ИНН ${profile.inn}`, profile.kpp && `КПП ${profile.kpp}`].filter(Boolean).join(', '),
        [profile.phone && `тел. ${profile.phone}`, profile.email].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ');

const buildClientBlock = (shipment: ShipmentDocumentRow): string => {
    const clientName = buildClientDisplayName({
        название: shipment.клиент_название,
        тип: shipment.клиент_тип,
        краткоеНазвание: shipment.клиент_краткое_название,
        полноеНазвание: shipment.клиент_полное_название,
        фамилия: shipment.клиент_фамилия,
        имя: shipment.клиент_имя,
        отчество: shipment.клиент_отчество,
    });
    const clientAddress = buildClientPrimaryAddress({
        адрес: shipment.клиент_адрес,
        адресРегистрации: shipment.клиент_адрес_регистрации,
        адресПечати: shipment.клиент_адрес_печати,
    }) || '';

    return [
        clientName,
        clientAddress,
        [
            shipment.клиент_инн && `ИНН ${shipment.клиент_инн}`,
            shipment.клиент_кпп && `КПП ${shipment.клиент_кпп}`,
        ].filter(Boolean).join(', '),
        [
            shipment.клиент_телефон && `тел. ${shipment.клиент_телефон}`,
            shipment.клиент_email,
        ].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n');
};

const buildClientTransportLine = (shipment: ShipmentDocumentRow): string => {
    const clientName = buildClientDisplayName({
        название: shipment.клиент_название,
        тип: shipment.клиент_тип,
        краткоеНазвание: shipment.клиент_краткое_название,
        полноеНазвание: shipment.клиент_полное_название,
        фамилия: shipment.клиент_фамилия,
        имя: shipment.клиент_имя,
        отчество: shipment.клиент_отчество,
    });
    const clientAddress = buildClientPrimaryAddress({
        адрес: shipment.клиент_адрес,
        адресРегистрации: shipment.клиент_адрес_регистрации,
        адресПечати: shipment.клиент_адрес_печати,
    }) || '';

    return [
        clientName,
        clientAddress,
        [
            shipment.клиент_инн && `ИНН ${shipment.клиент_инн}`,
            shipment.клиент_кпп && `КПП ${shipment.клиент_кпп}`,
        ].filter(Boolean).join(', '),
        [
            shipment.клиент_телефон && `тел. ${shipment.клиент_телефон}`,
            shipment.клиент_email,
        ].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ');
};

const buildCarrierTransportLine = (shipment: ShipmentDocumentRow): string =>
    [
        shipment.транспорт_название || 'Перевозчик не указан',
        [shipment.транспорт_телефон && `тел. ${shipment.транспорт_телефон}`, shipment.транспорт_email].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ');

const buildShipmentTransportSummary = (shipment: ShipmentDocumentRow): string => {
    if (!shipment.использовать_доставку) return 'Самовывоз';
    return [
        shipment.транспорт_название || 'Доставка',
        shipment.стоимость_доставки != null ? `стоимость доставки ${formatMoney(shipment.стоимость_доставки)} руб.` : '',
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

const buildClientTorgName = (shipment: ShipmentDocumentRow): string =>
    shipment.клиент_тип === 'Организация'
        ? normalizeNullableText(shipment.клиент_полное_название)
        || normalizeNullableText(shipment.клиент_краткое_название)
        || normalizeNullableText(shipment.клиент_название)
        : buildClientDisplayName({
            название: shipment.клиент_название,
            тип: shipment.клиент_тип,
            краткоеНазвание: shipment.клиент_краткое_название,
            полноеНазвание: shipment.клиент_полное_название,
            фамилия: shipment.клиент_фамилия,
            имя: shipment.клиент_имя,
            отчество: shipment.клиент_отчество,
        });

const buildClientTorgLine = (shipment: ShipmentDocumentRow, clientBankAccount: ClientBankAccount | null): string => {
    const clientAddress = buildClientPrimaryAddress({
        адрес: shipment.клиент_адрес,
        адресРегистрации: shipment.клиент_адрес_регистрации,
        адресПечати: shipment.клиент_адрес_печати,
    }) || '';

    return [
        buildClientTorgName(shipment),
        clientAddress,
        shipment.клиент_телефон && `тел. ${shipment.клиент_телефон}`,
        [shipment.клиент_инн && `ИНН ${shipment.клиент_инн}`, shipment.клиент_кпп && `КПП ${shipment.клиент_кпп}`].filter(Boolean).join(', '),
        [
            clientBankAccount?.settlementAccount && `р/с ${clientBankAccount.settlementAccount}`,
            clientBankAccount?.bankName && `в ${clientBankAccount.bankName}`,
            clientBankAccount?.correspondentAccount && `к/с ${clientBankAccount.correspondentAccount}`,
            clientBankAccount?.bik && `БИК ${clientBankAccount.bik}`,
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

const getPrimaryClientBankAccount = async (clientId: number | null): Promise<ClientBankAccount | null> => {
    if (!clientId) return null;

    const res = await query(
        `
        SELECT *
        FROM public."Расчетные_счета_клиентов"
        WHERE "клиент_id" = $1
        ORDER BY COALESCE("основной", false) DESC, sort_order ASC, id ASC
        LIMIT 1
        `,
        [clientId]
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

const buildShipmentCargoSummary = (positions: ShipmentDocumentPosition[]): string =>
    positions
        .map((position, index) => {
            const quantity = position.количество % 1 === 0
                ? String(position.количество)
                : String(position.количество).replace('.', ',');
            return `${index + 1}. ${position.товар_название} (${quantity} ${position.товар_единица_измерения || 'шт'})`;
        })
        .join('; ');

const buildShipmentUpdPayload = async (
    shipmentId: number,
    documentKey: Extract<ShipmentDocumentKey, 'shipment_upd_status_1' | 'shipment_upd_status_2'>
): Promise<ShipmentDocumentRenderPayload> => {
    const definition = getShipmentDocumentDefinition(documentKey);
    const { shipment, positions } = await getShipmentDocumentData(shipmentId);
    const availableDocuments = getAvailableShipmentDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
        usesDelivery: shipment.использовать_доставку,
    });

    if (!availableDocuments.some((item) => item.key === documentKey)) {
        throw new Error('Документ недоступен для состава этой отгрузки');
    }

    if (positions.length === 0) {
        throw new Error('В отгрузке нет позиций для формирования документа');
    }

    const [template, companyProfile, director, accountant] = await Promise.all([
        getDocumentTemplateDefinition(documentKey),
        getCompanyProfile(),
        getDirector(),
        getChiefAccountant(),
    ]);

    const sourceSheetName = 'стр.1';
    const targetSheetName = 'Документ';
    const shipmentDate = parseDateOnly(shipment.дата_отгрузки);
    const dateStringLong = formatDateRuLong(shipmentDate);
    const basis = buildShipmentBasis(shipment, shipmentDate);
    const clientName = buildClientDisplayName({
        название: shipment.клиент_название,
        тип: shipment.клиент_тип,
        краткоеНазвание: shipment.клиент_краткое_название,
        полноеНазвание: shipment.клиент_полное_название,
        фамилия: shipment.клиент_фамилия,
        имя: shipment.клиент_имя,
        отчество: shipment.клиент_отчество,
    });
    const clientAddress = buildClientPrimaryAddress({
        адрес: shipment.клиент_адрес,
        адресРегистрации: shipment.клиент_адрес_регистрации,
        адресПечати: shipment.клиент_адрес_печати,
    }) || '';
    const footerStartRow = 22 + (positions.length * 3);
    const footerEndRow = footerStartRow + 30;
    const totalNet = positions.reduce((sum, position) => sum + position.сумма_без_ндс, 0);
    const totalTax = positions.reduce((sum, position) => sum + position.сумма_ндс, 0);
    const totalAmount = positions.reduce((sum, position) => sum + position.сумма_всего, 0);
    const year = String(shipmentDate.getUTCFullYear());
    const directorName = director?.fio || companyProfile.directorName || '';
    const accountantName = accountant?.fio || companyProfile.accountantName || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';
    const directorShortName = toShortFio(directorName);
    const accountantShortName = toShortFio(accountantName);
    const footerRowOffset = footerStartRow - 31;
    const footerCell = (address: string, value: string | number, wrapText = false) =>
        excelCell(targetSheetName, shiftCellAddress(address, footerRowOffset), value, wrapText);

    const cells: RenderXlsxTemplateParams['cells'] = [
        excelCell(targetSheetName, 'AM1', shipment.id),
        excelCell(targetSheetName, 'BD1', dateStringLong),
        excelCell(targetSheetName, 'I6', documentKey === 'shipment_upd_status_1' ? 1 : 2),
        excelCell(targetSheetName, 'BA4', companyProfile.legalName, true),
        excelCell(targetSheetName, 'BA5', companyProfile.documentAddress || companyProfile.legalAddress, true),
        excelCell(targetSheetName, 'BA6', `${companyProfile.inn}/${companyProfile.kpp}`),
        excelCell(targetSheetName, 'BA7', buildCompanyBlock(companyProfile), true),
        excelCell(targetSheetName, 'BA8', clientName === '' ? '' : `${clientName}${clientAddress ? `, ${clientAddress}` : ''}`, true),
        excelCell(targetSheetName, 'BE10', `Исходящий УПД ${shipment.id}`),
        excelCell(targetSheetName, 'CJ10', dateStringLong),
        excelCell(targetSheetName, 'BA11', clientName, true),
        excelCell(targetSheetName, 'BA12', clientAddress, true),
        excelCell(targetSheetName, 'BA13', [shipment.клиент_инн, shipment.клиент_кпп].filter(Boolean).join('/') || ''),
        excelCell(targetSheetName, 'BA14', 'российский рубль, 643'),
        footerCell('B35', positions.length),
        footerCell('CJ31', Number(totalNet.toFixed(2))),
        footerCell('DZ31', Number(totalAmount.toFixed(2))),
        footerCell('AZ33', ''),
        footerCell('BO33', directorShortName),
        footerCell('DQ33', ''),
        footerCell('EM34', accountantShortName),
        footerCell('AR40', basis, true),
        footerCell('AF42', buildShipmentTransportSummary(shipment), true),
        footerCell('B45', directorPosition),
        footerCell('AA45', ''),
        footerCell('BA45', directorName),
        footerCell('CK45', ''),
        footerCell('DK45', ''),
        footerCell('EI45', ''),
        footerCell('AI47', String(shipmentDate.getUTCDate()).padStart(2, '0')),
        footerCell('AO47', getMonthRuGenitive(shipmentDate)),
        footerCell('BN47', year.slice(0, 2)),
        footerCell('BR47', year.slice(2)),
        footerCell('DS47', String(shipmentDate.getUTCDate()).padStart(2, '0')),
        footerCell('DY47', getMonthRuGenitive(shipmentDate)),
        footerCell('EV47', year.slice(0, 2)),
        footerCell('EZ47', year.slice(2)),
        footerCell('B49', ''),
        footerCell('CK49', ''),
        footerCell('B52', directorPosition),
        footerCell('AA52', ''),
        footerCell('BA52', directorName),
        footerCell('CK52', ''),
        footerCell('DK52', ''),
        footerCell('EI52', ''),
        footerCell('B55', companyProfile.legalName),
        footerCell('CK55', clientName),
    ];

    if (documentKey === 'shipment_upd_status_1') {
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

        if (documentKey === 'shipment_upd_status_1') {
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
    for (let row = 22; row < footerStartRow; row += 1) {
        const shouldShowRow = row < 22 + (positions.length * 3);
        rowVisibility.push({ sheetName: targetSheetName, row, hidden: !shouldShowRow });
    }
    for (let row = footerStartRow; row <= footerEndRow; row += 1) {
        rowVisibility.push({ sheetName: targetSheetName, row, hidden: false });
    }

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, shipment.id),
        cells,
        rowVisibility,
        rangeCopies,
        sheetCopies: [{ sourceSheetName, targetSheetName }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{ sheetName: targetSheetName, range: `A1:HB${footerEndRow}` }],
        sheetPageSetup: [{ sheetName: targetSheetName, fitToWidth: 1, fitToHeight: 0 }],
        pdfPostprocess: 'none',
    };
};

const sumBy = (positions: ShipmentDocumentPosition[], picker: (position: ShipmentDocumentPosition) => number): number =>
    positions.reduce((sum, position) => sum + picker(position), 0);

const buildShipmentTorg12Payload = async (shipmentId: number): Promise<ShipmentDocumentRenderPayload> => {
    const documentKey: ShipmentDocumentKey = 'shipment_torg_12';
    const definition = getShipmentDocumentDefinition(documentKey);
    const { shipment, positions } = await getShipmentDocumentData(shipmentId);
    const availableDocuments = getAvailableShipmentDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
        usesDelivery: shipment.использовать_доставку,
    });

    if (!availableDocuments.some((item) => item.key === documentKey)) {
        throw new Error('Документ недоступен для состава этой отгрузки');
    }

    if (positions.length === 0) {
        throw new Error('В отгрузке нет позиций для формирования документа');
    }

    const [template, companyProfile, director, chiefAccountant, clientBankAccount] = await Promise.all([
        getDocumentTemplateDefinition(documentKey),
        getCompanyProfile(),
        getDirector(),
        getChiefAccountant(),
        getPrimaryClientBankAccount(shipment.клиент_id),
    ]);

    const sourceSheetName = 'стр1';
    const targetSheetName = 'Документ';
    const shipmentDate = parseDateOnly(shipment.дата_отгрузки);
    const issueDate = parseDateOnly(new Date().toISOString());
    const issueDateParts = formatDateRuParts(issueDate);
    const clientLine = buildClientTorgLine(shipment, clientBankAccount);
    const companyLine = buildCompanyTorgLine(companyProfile);
    const totalQty = sumBy(positions, (position) => position.количество);
    const totalNet = sumBy(positions, (position) => position.сумма_без_ндс);
    const totalTax = sumBy(positions, (position) => position.сумма_ндс);
    const totalAmount = sumBy(positions, (position) => position.сумма_всего);
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
        excelCell(targetSheetName, 'A7', companyLine, true),
        excelCell(targetSheetName, 'A9', 'главный офис', true),
        excelCell(targetSheetName, 'A10', ''),
        excelCell(targetSheetName, 'L12', clientLine, true),
        excelCell(targetSheetName, 'I14', companyLine, true),
        excelCell(targetSheetName, 'I16', clientLine, true),
        excelCell(targetSheetName, 'I18', shipment.заявка_id ? 'Заявка' : 'Отгрузка', true),
        excelCell(targetSheetName, 'CF7', companyProfile.okpo),
        excelCell(targetSheetName, 'CF10', TORG_ACTIVITY_CODE),
        excelCell(targetSheetName, 'CF12', shipment.клиент_окпо || ''),
        excelCell(targetSheetName, 'CF13', companyProfile.okpo),
        excelCell(targetSheetName, 'CF15', shipment.клиент_окпо || ''),
        excelCell(targetSheetName, 'CF23', 'Отгрузка товаров'),
        excelCell(targetSheetName, 'AX26', shipment.id),
        excelCell(targetSheetName, 'BI26', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'CF17', shipment.заявка_id || shipment.id),
        excelCell(targetSheetName, 'CF19', shipment.заявка_дата_создания ? formatDateRuNumeric(parseDateOnly(shipment.заявка_дата_создания)) : formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'CF21', shipment.использовать_доставку ? shipment.id : ''),
        excelCell(targetSheetName, 'CF22', shipment.использовать_доставку ? formatDateRuNumeric(shipmentDate) : ''),
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
        fileBaseName: buildFileBaseName(definition.title, shipment.id),
        cells,
        rowVisibility,
        rowBreaks,
        sheetCopies: [{ sourceSheetName, targetSheetName }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{ sheetName: targetSheetName, range: 'A1:CQ89' }],
        sheetPageSetup: [{ sheetName: targetSheetName, fitToWidth: 1, fitToHeight: 0 }],
        pdfPostprocess: 'none',
    };
};

const buildShipmentTransportWaybillPayload = async (shipmentId: number): Promise<ShipmentDocumentRenderPayload> => {
    const documentKey: ShipmentDocumentKey = 'shipment_transport_waybill';
    const definition = getShipmentDocumentDefinition(documentKey);
    const { shipment, positions } = await getShipmentDocumentData(shipmentId);
    const availableDocuments = getAvailableShipmentDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
        usesDelivery: shipment.использовать_доставку,
    });

    if (!availableDocuments.some((item) => item.key === documentKey)) {
        throw new Error('Документ недоступен для этой отгрузки');
    }

    const [template, companyProfile, director] = await Promise.all([
        getDocumentTemplateDefinition(documentKey),
        getCompanyProfile(),
        getDirector(),
    ]);

    const sourceSheetName = 'стр.1_2';
    const targetSheetName = 'Документ';
    const shipmentDate = parseDateOnly(shipment.дата_отгрузки);
    const clientName = buildClientDisplayName({
        название: shipment.клиент_название,
        тип: shipment.клиент_тип,
        краткоеНазвание: shipment.клиент_краткое_название,
        полноеНазвание: shipment.клиент_полное_название,
        фамилия: shipment.клиент_фамилия,
        имя: shipment.клиент_имя,
        отчество: shipment.клиент_отчество,
    });
    const clientAddress = buildClientPrimaryAddress({
        адрес: shipment.клиент_адрес,
        адресРегистрации: shipment.клиент_адрес_регистрации,
        адресПечати: shipment.клиент_адрес_печати,
    }) || '';
    const companyTransportLine = buildCompanyTransportLine(companyProfile);
    const clientTransportLine = buildClientTransportLine(shipment);
    const cargoSummary = buildShipmentCargoSummary(positions);
    const totalQty = sumBy(positions, (position) => position.количество);
    const totalAmount = sumBy(positions, (position) => position.сумма_всего);
    const deliveryAmount = Number(shipment.стоимость_доставки) || 0;
    const carrierTransportLine = buildCarrierTransportLine(shipment);
    const directorName = companyProfile.directorName || director?.fio || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';

    const cells: RenderXlsxTemplateParams['cells'] = [
        // Top header has separate merged cells for labels and values:
        // B9:G9 / Y9:AC9 / BP9:BU9 / CM9:CP9 are labels,
        // H9:W9 / AD9:BN9 / BV9:CK9 / CQ9:DG9 are value areas.
        excelCell(targetSheetName, 'H9', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'AD9', shipment.id),
        excelCell(
            targetSheetName,
            'BV9',
            shipment.заявка_дата_создания
                ? formatDateRuNumeric(parseDateOnly(shipment.заявка_дата_создания))
                : formatDateRuNumeric(shipmentDate)
        ),
        excelCell(targetSheetName, 'CQ9', shipment.заявка_id || ''),
        excelCell(targetSheetName, 'X10', 1),
        excelCell(targetSheetName, 'B15', companyTransportLine, true),
        excelCell(targetSheetName, 'BP15', companyTransportLine, true),
        excelCell(targetSheetName, 'B20', clientTransportLine || clientName, true),
        excelCell(targetSheetName, 'B22', clientAddress, true),
        excelCell(targetSheetName, 'B25', cargoSummary, true),
        excelCell(targetSheetName, 'BF25', positions.length),
        excelCell(targetSheetName, 'B27', `Количество: ${Number(totalQty.toFixed(3))}; стоимость: ${formatMoney(totalAmount)} руб.`, true),
        excelCell(targetSheetName, 'BF29', formatMoney(totalAmount)),
        excelCell(targetSheetName, 'B32', shipment.использовать_доставку ? `Транспортная накладная № ${shipment.id} от ${formatDateRuNumeric(shipmentDate)}` : '', true),
        excelCell(targetSheetName, 'B34', shipment.заявка_id ? `Заявка № ${shipment.заявка_id}` : '', true),
        excelCell(targetSheetName, 'B36', buildShipmentBasis(shipment, shipmentDate), true),
        excelCell(targetSheetName, 'B39', `Маршрут: ${companyProfile.documentAddress || companyProfile.legalAddress} -> ${clientAddress}`, true),
        excelCell(targetSheetName, 'BF39', carrierTransportLine, true),
        excelCell(targetSheetName, 'B41', '', true),
        excelCell(targetSheetName, 'BF41', buildShipmentTransportSummary(shipment), true),
        excelCell(targetSheetName, 'B44', carrierTransportLine, true),
        excelCell(targetSheetName, 'BF44', '', true),
        excelCell(targetSheetName, 'B56', companyProfile.legalName, true),
        excelCell(
          targetSheetName,
          'B58',
          [companyProfile.legalName, companyProfile.inn ? `ИНН ${companyProfile.inn}` : null]
            .filter(Boolean)
            .join(', '),
          true
        ),
        excelCell(targetSheetName, 'B60', companyProfile.documentAddress || companyProfile.legalAddress, true),
        excelCell(targetSheetName, 'BF60', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B62', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'BF62', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B64', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'B66', positions.length),
        excelCell(targetSheetName, 'BF66', 'по местам'),
        excelCell(targetSheetName, 'B68', '', true),

        excelCell(targetSheetName, 'B79', clientAddress, true),
        excelCell(targetSheetName, 'BF79', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B81', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'BF81', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B83', 'Груз передан в исправном состоянии', true),
        excelCell(targetSheetName, 'BF83', positions.length),
        excelCell(targetSheetName, 'B85', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'BF85', '', true),

        excelCell(targetSheetName, 'B93', Number(deliveryAmount.toFixed(2))),
        excelCell(targetSheetName, 'AD93', 'без НДС'),
        excelCell(targetSheetName, 'BE93', 0),
        excelCell(targetSheetName, 'CF93', Number(deliveryAmount.toFixed(2))),

        excelCell(targetSheetName, 'B199', 'договор перевозки', true),
        excelCell(targetSheetName, 'BF99', buildShipmentBasis(shipment, shipmentDate), true),

    ];

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, shipment.id),
        cells,
        sheetCopies: [{ sourceSheetName, targetSheetName }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{ sheetName: targetSheetName, range: 'A1:DG106' }],
        sheetPageSetup: [{ sheetName: targetSheetName, fitToWidth: 1, fitToHeight: 0 }],
        pdfPostprocess: 'none',
    };
};

export const buildShipmentDocumentPayload = async (
    shipmentId: number,
    documentKey: ShipmentDocumentKey
): Promise<ShipmentDocumentRenderPayload> => {
    if (documentKey === 'shipment_torg_12') {
        return buildShipmentTorg12Payload(shipmentId);
    }

    if (documentKey === 'shipment_transport_waybill') {
        return buildShipmentTransportWaybillPayload(shipmentId);
    }

    return buildShipmentUpdPayload(shipmentId, documentKey);
};
