import { query } from './db';
import { getDocumentTemplateDefinition, type DocumentTemplateDefinition } from './documentTemplates';
import type { RenderXlsxTemplateParams } from './documentRendererClient';
import {
    getAvailableShipmentDocumentDefinitions,
    getShipmentDocumentDefinition,
    type ShipmentDocumentKey,
} from './shipmentDocumentDefinitions';
import { buildClientDisplayName, buildClientPrimaryAddress } from './clientContragents';

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
        SELECT e."фио" AS fio, e."должность" AS position
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        JOIN public."Сотрудники" e ON e.id = u.employee_id
        WHERE COALESCE(u.is_active, true) = true
          AND COALESCE(e."активен", true) = true
          AND LOWER(COALESCE(r.key, '')) = 'accountant'
        ORDER BY u.id ASC
        LIMIT 1
        `
    );

    let row = res.rows?.[0];
    if (!row?.fio) {
        const fallbackRes = await query(
            `
            SELECT "фио" AS fio, "должность" AS position
            FROM public."Сотрудники"
            WHERE COALESCE("активен", true) = true
              AND LOWER(COALESCE("должность", '')) LIKE '%бухгалтер%'
            ORDER BY id ASC
            LIMIT 1
            `
        );
        row = fallbackRes.rows?.[0];
    }

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
          AND LOWER(COALESCE("должность", '')) LIKE '%директор%'
        ORDER BY CASE WHEN LOWER(COALESCE("должность", '')) LIKE '%генераль%' THEN 0 ELSE 1 END, id ASC
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

const clearCells = (sheetName: string, addresses: string[]): RenderXlsxTemplateParams['cells'] =>
    addresses.map((address) => excelCell(sheetName, address, ''));

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

const buildShipmentTransportSummary = (shipment: ShipmentDocumentRow): string => {
    if (!shipment.использовать_доставку) return 'Самовывоз';
    return [
        shipment.транспорт_название || 'Доставка',
        shipment.стоимость_доставки != null ? `стоимость доставки ${formatMoney(shipment.стоимость_доставки)} руб.` : '',
    ].filter(Boolean).join(', ');
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
    const directorName = companyProfile.directorName || director?.fio || '';
    const accountantName = companyProfile.accountantName || accountant?.fio || '';

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
        excelCell(targetSheetName, 'AR40', basis, true),
        excelCell(targetSheetName, 'AF42', buildShipmentTransportSummary(shipment), true),
        excelCell(targetSheetName, 'B35', positions.length),
        excelCell(targetSheetName, 'CJ31', Number(totalNet.toFixed(2))),
        excelCell(targetSheetName, 'DZ31', Number(totalAmount.toFixed(2))),
        excelCell(targetSheetName, 'AA45', ''),
        excelCell(targetSheetName, 'BA45', ''),
        excelCell(targetSheetName, 'DK45', ''),
        excelCell(targetSheetName, 'EI45', ''),
        excelCell(targetSheetName, 'AI47', String(shipmentDate.getUTCDate()).padStart(2, '0')),
        excelCell(targetSheetName, 'AO47', new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(shipmentDate)),
        excelCell(targetSheetName, 'BN47', year.slice(0, 2)),
        excelCell(targetSheetName, 'BR47', year.slice(2)),
        excelCell(targetSheetName, 'AZ33', ''),
        excelCell(targetSheetName, 'BO33', directorName),
        excelCell(targetSheetName, 'DQ33', ''),
        excelCell(targetSheetName, 'EM34', accountantName),
    ];

    if (documentKey === 'shipment_upd_status_1') {
        cells.push(excelCell(targetSheetName, 'DM31', Number(totalTax.toFixed(2))));
    } else {
        cells.push(excelCell(targetSheetName, 'DM31', ''));
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

    const [template, companyProfile] = await Promise.all([
        getDocumentTemplateDefinition(documentKey),
        getCompanyProfile(),
    ]);

    const sourceSheetName = 'стр1';
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
    const companyBlock = buildCompanyBlock(companyProfile);
    const clientBlock = buildClientBlock(shipment);
    const totalQty = sumBy(positions, (position) => position.количество);
    const totalNet = sumBy(positions, (position) => position.сумма_без_ндс);
    const totalTax = sumBy(positions, (position) => position.сумма_ндс);
    const totalAmount = sumBy(positions, (position) => position.сумма_всего);
    const firstPagePositions = positions.slice(0, 12);
    const secondPagePositions = positions.slice(12);

    const cells: RenderXlsxTemplateParams['cells'] = [
        ...clearCells(targetSheetName, ['AX25', 'BI25', 'BY21', 'BY22']),
        excelCell(targetSheetName, 'I7', companyProfile.legalName, true),
        excelCell(targetSheetName, 'I10', companyBlock, true),
        excelCell(targetSheetName, 'BY7', clientName, true),
        excelCell(targetSheetName, 'BY10', clientBlock || clientAddress, true),
        excelCell(targetSheetName, 'AX25', shipment.id),
        excelCell(targetSheetName, 'BI25', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'BY21', shipment.использовать_доставку ? 'по транспортной накладной' : ''),
        excelCell(targetSheetName, 'BY22', shipment.использовать_доставку ? formatDateRuNumeric(shipmentDate) : ''),
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
        excelCell(targetSheetName, 'D66', positions.length),
        excelCell(targetSheetName, 'AC70', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'D72', positions.length),
        excelCell(targetSheetName, 'AC72', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'N78', amountToWordsRub(totalAmount), true),
        excelCell(targetSheetName, 'AJ79', Math.floor(totalAmount + 1e-9)),
        excelCell(targetSheetName, 'AT79', Math.round((totalAmount - Math.floor(totalAmount + 1e-9)) * 100)),
    ];

    positions.forEach((position, index) => {
        const row = TORG_ITEM_ROWS[index];
        const vatRateLabel = position.ндс_ставка > 0 ? `${position.ндс_ставка}%` : 'без НДС';
        cells.push(
            excelCell(targetSheetName, `A${row}`, index + 1),
            excelCell(targetSheetName, `D${row}`, position.товар_название, true),
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
    const companyBlock = buildCompanyBlock(companyProfile);
    const clientBlock = buildClientBlock(shipment);
    const cargoSummary = buildShipmentCargoSummary(positions);
    const totalQty = sumBy(positions, (position) => position.количество);
    const totalAmount = sumBy(positions, (position) => position.сумма_всего);
    const deliveryAmount = Number(shipment.стоимость_доставки) || 0;
    const transportBlock = [
        shipment.транспорт_название || 'Перевозчик не указан',
        [shipment.транспорт_телефон && `тел. ${shipment.транспорт_телефон}`, shipment.транспорт_email].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n');
    const directorName = companyProfile.directorName || director?.fio || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';

    const cells: RenderXlsxTemplateParams['cells'] = [
        excelCell(targetSheetName, 'B9', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'Y9', shipment.id),
        excelCell(targetSheetName, 'BP9', shipment.заявка_дата_создания ? formatDateRuNumeric(parseDateOnly(shipment.заявка_дата_создания)) : formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'CM9', shipment.заявка_id || ''),
        excelCell(targetSheetName, 'B16', companyBlock, true),
        excelCell(targetSheetName, 'BP16', companyBlock, true),
        excelCell(targetSheetName, 'B21', clientBlock || clientName, true),
        excelCell(targetSheetName, 'B23', clientAddress, true),
        excelCell(targetSheetName, 'B26', cargoSummary, true),
        excelCell(targetSheetName, 'BF26', positions.length),
        excelCell(targetSheetName, 'B28', `Количество: ${Number(totalQty.toFixed(3))}; стоимость: ${formatMoney(totalAmount)} руб.`, true),
        excelCell(targetSheetName, 'BF30', formatMoney(totalAmount)),
        excelCell(targetSheetName, 'B33', shipment.использовать_доставку ? `Транспортная накладная № ${shipment.id} от ${formatDateRuNumeric(shipmentDate)}` : '', true),
        excelCell(targetSheetName, 'B35', shipment.заявка_id ? `Заявка № ${shipment.заявка_id}` : '', true),
        excelCell(targetSheetName, 'B37', buildShipmentBasis(shipment, shipmentDate), true),
        excelCell(targetSheetName, 'B40', `Маршрут: ${companyProfile.documentAddress || companyProfile.legalAddress} -> ${clientAddress}`, true),
        excelCell(targetSheetName, 'BF40', companyProfile.phone, true),
        excelCell(targetSheetName, 'B42', '', true),
        excelCell(targetSheetName, 'BF42', buildShipmentTransportSummary(shipment), true),
        excelCell(targetSheetName, 'B45', transportBlock, true),
        excelCell(targetSheetName, 'BF45', shipment.транспорт_название || '', true),
        excelCell(targetSheetName, 'B57', companyProfile.legalName, true),
        excelCell(targetSheetName, 'B59', companyProfile.legalName, true),
        excelCell(targetSheetName, 'B61', companyProfile.documentAddress || companyProfile.legalAddress, true),
        excelCell(targetSheetName, 'BF61', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B63', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'BF63', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B65', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'B67', positions.length),
        excelCell(targetSheetName, 'BF67', 'по местам'),
        excelCell(targetSheetName, 'B69', '', true),
        excelCell(targetSheetName, 'B71', `${directorPosition}, ${directorName}`, true),
        excelCell(targetSheetName, 'BF71', shipment.транспорт_название || '', true),
        excelCell(targetSheetName, 'B80', clientAddress, true),
        excelCell(targetSheetName, 'BF80', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B82', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'BF82', formatDateRuNumeric(shipmentDate)),
        excelCell(targetSheetName, 'B84', 'Груз передан в исправном состоянии', true),
        excelCell(targetSheetName, 'BF84', positions.length),
        excelCell(targetSheetName, 'B86', Number(totalQty.toFixed(3))),
        excelCell(targetSheetName, 'BF86', '', true),
        excelCell(targetSheetName, 'B88', clientName || 'Грузополучатель', true),
        excelCell(targetSheetName, 'BF88', shipment.транспорт_название || '', true),
        excelCell(targetSheetName, 'B94', Number(deliveryAmount.toFixed(2))),
        excelCell(targetSheetName, 'AD94', 'без НДС'),
        excelCell(targetSheetName, 'BE94', 0),
        excelCell(targetSheetName, 'CF94', Number(deliveryAmount.toFixed(2))),
        excelCell(targetSheetName, 'B98', transportBlock, true),
        excelCell(targetSheetName, 'BF98', companyBlock, true),
        excelCell(targetSheetName, 'B100', 'договор перевозки', true),
        excelCell(targetSheetName, 'BF100', buildShipmentBasis(shipment, shipmentDate), true),
        excelCell(targetSheetName, 'BF102', companyProfile.legalName, true),
        excelCell(targetSheetName, 'B104', shipment.транспорт_название || '', true),
        excelCell(targetSheetName, 'BF104', directorName, true),
        excelCell(targetSheetName, 'B106', '', true),
        excelCell(targetSheetName, 'BF106', `${directorPosition}, ${formatDateRuNumeric(shipmentDate)}`, true),
    ];

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title, shipment.id),
        cells,
        sheetCopies: [{ sourceSheetName, targetSheetName }],
        hiddenSheets: [sourceSheetName],
        printAreas: [{ sheetName: targetSheetName, range: 'A1:CR106' }],
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
