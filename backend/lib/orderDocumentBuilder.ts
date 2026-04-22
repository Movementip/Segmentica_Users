import {
    buildClientDisplayName,
    buildClientPrimaryAddress,
    normalizeClientContragentType,
    type ClientBankAccount,
} from './clientContragents';
import { readFile } from 'fs/promises';
import path from 'path';
import { query } from './db';
import { getDocumentTemplateDefinition, type DocumentTemplateDefinition } from './documentTemplates';
import {
    getAvailableOrderDocumentDefinitions,
    getOrderDocumentDefinition,
    type OrderDocumentKey,
} from './orderDocumentDefinitions';

type OrderDocumentRow = {
    id: number;
    дата_создания: string;
    клиент_id: number;
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

type OrderDocumentPosition = {
    id: number;
    товар_название: string;
    товар_единица_измерения: string | null;
    товар_тип_номенклатуры: string | null;
    количество: number;
    цена: number;
    сумма_ндс: number;
    сумма_всего: number;
};

type StatementActor = {
    fio: string;
    position: string | null;
};

type OrderDocumentCompanyProfile = {
    displayName: string;
    legalName: string;
    legalAddress: string;
    documentAddress: string;
    inn: string;
    kpp: string;
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

export type OrderDocumentRenderPayload = {
    documentTitle: string;
    template: DocumentTemplateDefinition;
    fileBaseName: string;
    replacements: Record<string, string>;
    replaceFirstImageBase64?: string;
};

const COMPANY_PROFILE: OrderDocumentCompanyProfile = {
    displayName: 'ООО "СЕГМЕНТИКА"',
    legalName: 'Общество с ограниченной ответственностью "Сегментика"',
    legalAddress: '620061, Свердловская обл, город Екатеринбург г.о., Исток п, Главная ул, строение 21, помещение 421',
    documentAddress: '620061, Свердловская обл, город Екатеринбург г.о., Исток п, Главная ул, строение 21, помещение 421',
    inn: '6685205790',
    kpp: '668501001',
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

const COMPANY_PROFILE_SETTINGS_KEY = 'company_profile';
const ORDER_INVOICE_LOGO_PATH = path.join(process.cwd(), 'utils', 'logo-icon.png');

const normalizeNullableText = (value: unknown): string => {
    if (value == null) return '';
    const text = String(value).trim();
    return text || '';
};

const formatDateRu = (value: Date): string => {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    return `${day}.${month}.${year}`;
};

const parseDateOnly = (value: string): Date => {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const formatMoney = (value: number): string =>
    new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const formatDateRuLong = (value: Date): string => {
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
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = months[value.getUTCMonth()] || '';
    const year = value.getUTCFullYear();
    return `«${day}» ${month} ${year} г.`;
};

const getCompanyProfile = async (): Promise<OrderDocumentCompanyProfile> => {
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
            return COMPANY_PROFILE;
        }

        const value = raw as Record<string, unknown>;
        return {
            displayName: normalizeNullableText(value.displayName ?? value.shortName) || COMPANY_PROFILE.displayName,
            legalName: normalizeNullableText(value.legalName ?? value.fullName) || COMPANY_PROFILE.legalName,
            legalAddress: normalizeNullableText(value.legalAddress ?? value.address) || COMPANY_PROFILE.legalAddress,
            documentAddress: normalizeNullableText(value.documentAddress ?? value.postalAddress) || COMPANY_PROFILE.documentAddress,
            inn: normalizeNullableText(value.inn) || COMPANY_PROFILE.inn,
            kpp: normalizeNullableText(value.kpp) || COMPANY_PROFILE.kpp,
            bankName: normalizeNullableText(value.bankName ?? value.bank) || COMPANY_PROFILE.bankName,
            bik: normalizeNullableText(value.bik) || COMPANY_PROFILE.bik,
            correspondentAccount: normalizeNullableText(value.correspondentAccount ?? value.ks) || COMPANY_PROFILE.correspondentAccount,
            settlementAccount: normalizeNullableText(value.settlementAccount ?? value.rs) || COMPANY_PROFILE.settlementAccount,
            phone: normalizeNullableText(value.phone) || COMPANY_PROFILE.phone,
            email: normalizeNullableText(value.email) || COMPANY_PROFILE.email,
            city: normalizeNullableText(value.city) || COMPANY_PROFILE.city,
            directorName: normalizeNullableText(
                value.directorName ?? value.generalDirectorName ?? value.signatoryName ?? value.fioForSignature
            ) || COMPANY_PROFILE.directorName,
            directorPosition: normalizeNullableText(
                value.directorPosition ?? value.generalDirectorPosition ?? value.signatoryPosition ?? value.positionForSignature
            ) || COMPANY_PROFILE.directorPosition,
            accountantName: normalizeNullableText(
                value.accountantName ?? value.chiefAccountantName ?? value.chiefAccountantFio ?? value.accountantFio
            ) || COMPANY_PROFILE.accountantName,
            accountantPosition: normalizeNullableText(
                value.accountantPosition ?? value.chiefAccountantPosition ?? value.accountantTitle
            ) || COMPANY_PROFILE.accountantPosition,
            paymentTerms: normalizeNullableText(value.paymentTerms ?? value.invoicePaymentTerms) || COMPANY_PROFILE.paymentTerms,
        };
    } catch {
        return COMPANY_PROFILE;
    }
};

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

const getPrimaryClientBankAccount = async (clientId: number): Promise<ClientBankAccount | null> => {
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

const getOrderDocumentData = async (orderId: number): Promise<{ order: OrderDocumentRow; positions: OrderDocumentPosition[] }> => {
    const orderRes = await query(
        `
        SELECT
            z.id,
            z."дата_создания",
            z."клиент_id",
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
        FROM public."Заявки" z
        LEFT JOIN public."Клиенты" k ON k.id = z."клиент_id"
        WHERE z.id = $1
        LIMIT 1
        `,
        [orderId]
    );

    const order = orderRes.rows?.[0] as OrderDocumentRow | undefined;
    if (!order) {
        throw new Error('Заявка не найдена');
    }

    const positionsRes = await query(
        `
        SELECT
            p.id,
            t."название" AS товар_название,
            t."единица_измерения" AS товар_единица_измерения,
            t."тип_номенклатуры" AS товар_тип_номенклатуры,
            COALESCE(p."количество", 0)::numeric AS количество,
            COALESCE(p."цена", 0)::numeric AS цена,
            (
                COALESCE(p."количество", 0)
                * COALESCE(p."цена", 0)
                * COALESCE(v."ставка", 0)
                / 100.0
            )::numeric AS сумма_ндс,
            (
                COALESCE(p."количество", 0)
                * COALESCE(p."цена", 0)
                * (1 + COALESCE(v."ставка", 0) / 100.0)
            )::numeric AS сумма_всего
        FROM public."Позиции_заявки" p
        LEFT JOIN public."Товары" t ON t.id = p."товар_id"
        LEFT JOIN public."Ставки_НДС" v ON v.id = p."ндс_id"
        WHERE p."заявка_id" = $1
        ORDER BY p.id ASC
        `,
        [orderId]
    );

    const positions = (positionsRes.rows || []).map((row: any): OrderDocumentPosition => ({
        id: Number(row.id),
        товар_название: normalizeNullableText(row.товар_название),
        товар_единица_измерения: normalizeNullableText(row.товар_единица_измерения) || 'шт',
        товар_тип_номенклатуры: normalizeNullableText(row.товар_тип_номенклатуры) || null,
        количество: Number(row.количество) || 0,
        цена: Number(row.цена) || 0,
        сумма_ндс: Number(row.сумма_ндс) || 0,
        сумма_всего: Number(row.сумма_всего) || 0,
    }));

    return { order, positions };
};

const buildOrderItemsBlock = (positions: OrderDocumentPosition[]): string =>
    positions
        .map((position, index) => {
            const quantity = position.количество % 1 === 0
                ? String(position.количество)
                : String(position.количество).replace('.', ',');
            return `\t\t${index + 1}. ${position.товар_название} — ${quantity} ${position.товар_единица_измерения || 'шт'} × ${formatMoney(position.цена)} руб. = ${formatMoney(position.сумма_всего)} руб.`;
        })
        .join('\n');

const buildOrderInvoiceStructuredRows = (positions: OrderDocumentPosition[]) =>
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

const buildOrderSpecificationItemsBlock = (positions: OrderDocumentPosition[]): string =>
    positions
        .map((position, index) => {
            const quantity = position.количество % 1 === 0
                ? String(position.количество)
                : String(position.количество).replace('.', ',');
            return `${index + 1}\t${position.товар_название}\t${quantity} ${position.товар_единица_измерения || 'шт'}\t${formatMoney(position.цена)}`;
        })
        .join('\n');

const buildOrderSpecificationRows = (positions: OrderDocumentPosition[]) =>
    positions.map((position, index) => {
        const quantity = position.количество % 1 === 0
            ? String(position.количество)
            : String(position.количество).replace('.', ',');
        return {
            number: String(index + 1),
            name: position.товар_название,
            quantity: `${quantity} ${position.товар_единица_измерения || 'шт'}`,
            price: formatMoney(position.цена),
        };
    });

const buildOrderSpecificationTotal = (positions: OrderDocumentPosition[]): string => {
    if (!positions.length) return '0 поз.';

    const units = Array.from(
        new Set(
            positions
                .map((position) => normalizeNullableText(position.товар_единица_измерения))
                .filter(Boolean)
        )
    );

    if (units.length === 1) {
        const totalQuantity = positions.reduce((sum, position) => sum + (Number(position.количество) || 0), 0);
        const quantity = totalQuantity % 1 === 0
            ? String(totalQuantity)
            : String(totalQuantity).replace('.', ',');
        return `${quantity} ${units[0]}`;
    }

    return `${positions.length} поз.`;
};

const buildOrderBasis = (orderId: number, documentDate: Date): string =>
    `Заявка № ${orderId} от ${formatDateRu(documentDate)}`;

const buildFileBaseName = (title: string): string => title;

const getOrderInvoiceLogoBase64 = async (): Promise<string | undefined> => {
    try {
        const buffer = await readFile(ORDER_INVOICE_LOGO_PATH);
        return buffer.toString('base64');
    } catch {
        return undefined;
    }
};

export const buildOrderDocumentPayload = async (
    orderId: number,
    documentKey: OrderDocumentKey
): Promise<OrderDocumentRenderPayload> => {
    const definition = getOrderDocumentDefinition(documentKey);
    const { order, positions } = await getOrderDocumentData(orderId);
    const availableDocuments = getAvailableOrderDocumentDefinitions({
        nomenclatureTypes: positions.map((position) => position.товар_тип_номенклатуры || ''),
    });

    if (!availableDocuments.some((item) => item.key === documentKey)) {
        throw new Error('Документ недоступен для состава этой заявки');
    }

    const [director, accountant, clientBankAccount, companyProfile, template, replaceFirstImageBase64] = await Promise.all([
        getDirector(),
        getChiefAccountant(),
        getPrimaryClientBankAccount(order.клиент_id),
        getCompanyProfile(),
        getDocumentTemplateDefinition(documentKey),
        documentKey === 'order_invoice' || documentKey === 'order_invoice_alt'
            ? getOrderInvoiceLogoBase64()
            : Promise.resolve(undefined),
    ]);

    const documentDate = new Date();
    const orderDate = parseDateOnly(order.дата_создания);
    const clientName = buildClientDisplayName({
        название: order.клиент_название,
        тип: order.клиент_тип,
        краткоеНазвание: order.клиент_краткое_название,
        полноеНазвание: order.клиент_полное_название,
        фамилия: order.клиент_фамилия,
        имя: order.клиент_имя,
        отчество: order.клиент_отчество,
    });
    const clientAddress = buildClientPrimaryAddress({
        адрес: order.клиент_адрес,
        адресРегистрации: order.клиент_адрес_регистрации,
        адресПечати: order.клиент_адрес_печати,
    }) || '';
    const clientType = normalizeClientContragentType(order.клиент_тип);
    const totalAmount = positions.reduce((sum, position) => sum + position.сумма_всего, 0);
    const totalVat = positions.reduce((sum, position) => sum + position.сумма_ндс, 0);
    const sixtyPercentAmount = totalAmount * 0.6;
    const fortyPercentAmount = totalAmount * 0.4;
    const basis = buildOrderBasis(order.id, orderDate);
    const itemsBlock = documentKey === 'order_supply_specification'
        ? buildOrderSpecificationItemsBlock(positions)
        : buildOrderItemsBlock(positions);

    const directorFio = companyProfile.directorName || director?.fio || '';
    const directorPosition = companyProfile.directorPosition || director?.position || 'Генеральный директор';
    const accountantFio = accountant?.fio || companyProfile.accountantName || directorFio;
    const clientPersonFullName = [order.клиент_фамилия, order.клиент_имя, order.клиент_отчество]
        .map((value) => normalizeNullableText(value))
        .filter(Boolean)
        .join(' ');
    const clientSignatoryFio = clientType === 'Организация'
        ? ''
        : (clientPersonFullName || clientName);
    const clientPosition = clientType === 'Организация'
        ? 'генеральный директор'
        : clientType === 'Индивидуальный предприниматель'
            ? 'индивидуальный предприниматель'
            : clientType === 'Физическое лицо'
                ? 'физическое лицо'
                : 'уполномоченный представитель';
    const specificationRows = buildOrderSpecificationRows(positions);
    const invoiceStructuredRows = buildOrderInvoiceStructuredRows(positions);
    const buyerLineParts = [
        clientName,
        normalizeNullableText(order.клиент_инн) && `ИНН: ${normalizeNullableText(order.клиент_инн)}`,
        normalizeNullableText(order.клиент_кпп) && `КПП: ${normalizeNullableText(order.клиент_кпп)}`,
    ].filter(Boolean);
    const companyContacts = [
        normalizeNullableText(companyProfile.phone) && `Телефон: ${normalizeNullableText(companyProfile.phone)}`,
        normalizeNullableText(companyProfile.email) && `Эл. почта: ${normalizeNullableText(companyProfile.email)}`,
    ].filter(Boolean);

    const replacements: Record<string, string> = {
        '{НомерДокумента}': String(order.id),
        '{ДатаДокумента}': formatDateRu(documentDate),
        '{ГородДокумента}': companyProfile.city,
        '{НазваниеОрганизации}': companyProfile.displayName,
        '{ЮридическийАдрес}': companyProfile.legalAddress,
        '{АдресДляДокументов}': companyProfile.documentAddress || companyProfile.legalAddress,
        '{ИНН}': companyProfile.inn,
        '{КПП}': companyProfile.kpp,
        '{НаименованиеБанка}': companyProfile.bankName,
        '{БИК}': companyProfile.bik,
        '{КоррСчет}': companyProfile.correspondentAccount,
        '{РасчетныйСчет}': companyProfile.settlementAccount,
        '{ПочтаДляДокументов}': companyProfile.email,
        '{Телефон}': companyProfile.phone,
        '{ВЛице}': directorFio,
        '{ДолжностьРуководителя}': directorPosition,
        '{ФИОДляПодписи}': directorFio,
        '{ФИОБухгалтераДляПодписи}': accountantFio,
        '{ДолжностьИсполнителя}': directorPosition,
        '{ФИОИсполнителяДляПодписи}': directorFio,
        '{НазваниеКонтр}': clientName,
        '{АдресКонтр}': clientAddress,
        '{ИННКонтр}': normalizeNullableText(order.клиент_инн),
        '{КППКонтр}': normalizeNullableText(order.клиент_кпп),
        '{НаименованиеБанкаКонтр}': normalizeNullableText(clientBankAccount?.bankName),
        '{БИКБанкаКонтр}': normalizeNullableText(clientBankAccount?.bik),
        '{КоррСчетКонтр}': normalizeNullableText(clientBankAccount?.correspondentAccount),
        '{РасчетныйСчетКонтр}': normalizeNullableText(clientBankAccount?.settlementAccount),
        '{ПочтаКонтрДляДокументов}': normalizeNullableText(order.клиент_email),
        '{ТелефонКонтр}': normalizeNullableText(order.клиент_телефон),
        '{ДолжностьКонтр}': clientPosition,
        '{ФИОКонтрДляПодписи}': clientSignatoryFio,
        '{Основание}': basis,
        '{КоличествоПозиций}': String(positions.length),
        '{ФактурнаяЧасть}': itemsBlock,
        '{СуммаДокументаВСЕГО}': formatMoney(totalAmount),
        '{СуммаДокументаПрописью}': amountToWordsRub(totalAmount),
        '{СуммаНДСПрописью}': totalVat > 0 ? amountToWordsRub(totalVat) : 'без НДС',
        '{60ОтСуммыДокумента}': formatMoney(sixtyPercentAmount),
        '{40ОтСуммыДокумента}': formatMoney(fortyPercentAmount),
        '{УсловияОплаты}': companyProfile.paymentTerms,
        '__SPECIFICATION_HEADER_BASIS__': `от ${formatDateRuLong(orderDate)} № ${order.id}`,
        '__SPECIFICATION_TITLE__': `СПЕЦИФИКАЦИЯ № ${order.id}`,
        '__SPECIFICATION_DATE_LONG__': formatDateRuLong(documentDate),
        '__SPECIFICATION_TOTAL__': buildOrderSpecificationTotal(positions),
        '__SPECIFICATION_ROWS_JSON__': JSON.stringify(specificationRows),
        '__SPECIFICATION_SUPPLIER_NAME__': companyProfile.displayName,
        '__SPECIFICATION_SUPPLIER_POSITION__': directorPosition,
        '__SPECIFICATION_SUPPLIER_FIO__': directorFio,
        '__SPECIFICATION_BUYER_LABEL__': 'Покупатель:',
        '__SPECIFICATION_BUYER_NAME__': clientName,
        '__SPECIFICATION_BUYER_POSITION__': clientPosition,
        '__SPECIFICATION_BUYER_FIO__': clientSignatoryFio,
        '__ALT_INVOICE_COMPANY_NAME__': companyProfile.displayName,
        '__ALT_INVOICE_COMPANY_ADDRESS__': companyProfile.documentAddress || companyProfile.legalAddress,
        '__ALT_INVOICE_COMPANY_CONTACTS__': companyContacts.join('\n'),
        '__ALT_INVOICE_BANK_NAME__': companyProfile.bankName,
        '__ALT_INVOICE_BIK__': companyProfile.bik,
        '__ALT_INVOICE_CORR_ACCOUNT__': companyProfile.correspondentAccount,
        '__ALT_INVOICE_INN__': companyProfile.inn,
        '__ALT_INVOICE_KPP__': companyProfile.kpp,
        '__ALT_INVOICE_SETTLEMENT_ACCOUNT__': companyProfile.settlementAccount,
        '__ALT_INVOICE_RECIPIENT__': companyProfile.displayName,
        '__ALT_INVOICE_TITLE__': `Счёт № ${order.id} от ${formatDateRu(documentDate)}`,
        '__ALT_INVOICE_SUPPLIER_NAME__': companyProfile.displayName,
        '__ALT_INVOICE_BUYER_TEXT__': buyerLineParts.join(', '),
        '__ALT_INVOICE_ROWS_JSON__': JSON.stringify(invoiceStructuredRows),
        '__ALT_INVOICE_TOTAL_LINE__': `Итого к оплате: ${formatMoney(totalAmount)}\nВ том числе НДС: ${totalVat > 0 ? formatMoney(totalVat) : 'Без НДС'}`,
        '__ALT_INVOICE_TOTAL_WORDS__': `Всего к оплате: ${amountToWordsRub(totalAmount)}, ${totalVat > 0 ? `в том числе НДС ${formatMoney(totalVat)} руб.` : 'без НДС.'}`,
        '__ALT_INVOICE_SIGN_LABEL__': 'Поставщик',
        '__ALT_INVOICE_SIGN_POSITION__': directorPosition,
        '__ALT_INVOICE_SIGN_FIO__': directorFio,
    };

    return {
        documentTitle: definition.title,
        template,
        fileBaseName: buildFileBaseName(definition.title),
        replacements,
        replaceFirstImageBase64,
    };
};
