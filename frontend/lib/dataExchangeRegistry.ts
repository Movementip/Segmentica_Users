import * as XLSX from 'xlsx';
import { withTransaction, query } from './db';
import {
    DATA_EXCHANGE_CATALOGS,
    getDataExchangeCatalogMeta,
    type DataExchangeCatalogKey,
    type DataExchangeFormat,
} from './dataExchangeConfig';

type Queryable = {
    query: (text: string, params?: any[]) => Promise<any>;
};

type DataExchangeSummary = {
    created: number;
    updated: number;
    skipped: number;
    warnings: string[];
};

type DataExchangeRegistryEntry = {
    key: DataExchangeCatalogKey;
    exportRows: (queryable: Queryable) => Promise<Record<string, unknown>[]>;
    importRows: (queryable: Queryable, rows: Record<string, unknown>[]) => Promise<DataExchangeSummary>;
};

type ParsedImportPayload = {
    rowsByCatalog: Partial<Record<DataExchangeCatalogKey, Record<string, unknown>[]>>;
};

const emptySummary = (): DataExchangeSummary => ({
    created: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
});

const normalizeString = (value: unknown): string | null => {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
};

const normalizeNumber = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const text = String(value).replace(/\s/g, '').replace(',', '.');
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeInteger = (value: unknown): number | null => {
    const num = normalizeNumber(value);
    if (num == null) return null;
    const int = Math.trunc(num);
    return Number.isFinite(int) ? int : null;
};

const normalizeBoolean = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    if (value == null || value === '') return null;
    const text = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'да', 'активен', 'вкл'].includes(text)) return true;
    if (['false', '0', 'no', 'n', 'нет', 'неактивен', 'выкл'].includes(text)) return false;
    return null;
};

const normalizeDate = (value: unknown): string | null => {
    if (value == null || value === '') return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    if (!text) return null;
    const parsed = new Date(text);
    if (!Number.isFinite(parsed.getTime())) return text;
    return parsed.toISOString().slice(0, 10);
};

const normalizeDateTime = (value: unknown): string | null => {
    if (value == null || value === '') return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return value.toISOString();
    }
    const text = String(value).trim();
    if (!text) return null;
    const parsed = new Date(text);
    if (!Number.isFinite(parsed.getTime())) return text;
    return parsed.toISOString();
};

const parseJsonCell = <T>(value: unknown, fallback: T): T => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value as T;
    try {
        return JSON.parse(String(value)) as T;
    } catch {
        return fallback;
    }
};

const normalizeRows = (rows: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
};

const ensureSequence = async (queryable: Queryable, tableName: string, columnName: string = 'id') => {
    await queryable.query(
        `
        SELECT setval(
            pg_get_serial_sequence($1, $2),
            COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
            true
        )
        `,
        [tableName, columnName]
    );
};

const mapExcelLikeRows = (sheet: XLSX.WorkSheet | undefined) => {
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return normalizeRows(rows);
};

const toWorkbookBuffer = (rowsByCatalog: Partial<Record<DataExchangeCatalogKey, Record<string, unknown>[]>>) => {
    const workbook = XLSX.utils.book_new();
    for (const [catalogKey, rows] of Object.entries(rowsByCatalog) as Array<[DataExchangeCatalogKey, Record<string, unknown>[]]>) {
        const meta = getDataExchangeCatalogMeta(catalogKey);
        if (!meta) continue;
        const worksheet = XLSX.utils.json_to_sheet(rows ?? []);
        XLSX.utils.book_append_sheet(workbook, worksheet, meta.sheetName);
    }
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const toCsvBuffer = (rows: Record<string, unknown>[]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows ?? []);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csv, 'utf-8');
};

const toJsonBuffer = (payload: unknown) => {
    return Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
};

const getExportContentType = (format: DataExchangeFormat) => {
    if (format === 'excel') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (format === 'csv') return 'text/csv; charset=utf-8';
    return 'application/json; charset=utf-8';
};

const getFileExtension = (format: DataExchangeFormat) => {
    if (format === 'excel') return 'xlsx';
    if (format === 'csv') return 'csv';
    return 'json';
};

const getCatalogSheetByName = (workbook: XLSX.WorkBook, catalogKey: DataExchangeCatalogKey) => {
    const meta = getDataExchangeCatalogMeta(catalogKey);
    if (!meta) return undefined;
    return workbook.Sheets[meta.sheetName] || workbook.Sheets[catalogKey] || workbook.Sheets[meta.label];
};

const replaceClientBankAccounts = async (
    queryable: Queryable,
    clientId: number,
    accounts: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public."Расчетные_счета_клиентов" WHERE "клиент_id" = $1', [clientId]);
    for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        await queryable.query(
            `
            INSERT INTO public."Расчетные_счета_клиентов" (
                "клиент_id", "название", "бик", "банк", "к_с", "р_с", "основной", sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                clientId,
                normalizeString(account.name ?? account.название) ?? `Счет ${index + 1}`,
                normalizeString(account.bik ?? account.бик),
                normalizeString(account.bankName ?? account.банк),
                normalizeString(account.correspondentAccount ?? account.к_с),
                normalizeString(account.settlementAccount ?? account.р_с),
                normalizeBoolean(account.isPrimary ?? account.основной) ?? index === 0,
                normalizeInteger(account.sortOrder ?? account.sort_order) ?? index,
            ]
        );
    }
};

const replaceSupplierBankAccounts = async (
    queryable: Queryable,
    supplierId: number,
    accounts: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public."Расчетные_счета_поставщиков" WHERE "поставщик_id" = $1', [supplierId]);
    for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        await queryable.query(
            `
            INSERT INTO public."Расчетные_счета_поставщиков" (
                "поставщик_id", "название", "бик", "банк", "к_с", "р_с", "основной", sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                supplierId,
                normalizeString(account.name ?? account.название) ?? `Счет ${index + 1}`,
                normalizeString(account.bik ?? account.бик),
                normalizeString(account.bankName ?? account.банк),
                normalizeString(account.correspondentAccount ?? account.к_с),
                normalizeString(account.settlementAccount ?? account.р_с),
                normalizeBoolean(account.isPrimary ?? account.основной) ?? index === 0,
                normalizeInteger(account.sortOrder ?? account.sort_order) ?? index,
            ]
        );
    }
};

const replaceOrderPositions = async (
    queryable: Queryable,
    orderId: number,
    positions: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public."Позиции_заявки" WHERE "заявка_id" = $1', [orderId]);
    for (const position of positions) {
        const productId = normalizeInteger(position.product_id ?? position.товар_id);
        const quantity = normalizeInteger(position.quantity ?? position.количество);
        if (productId == null || quantity == null) continue;
        await queryable.query(
            `
            INSERT INTO public."Позиции_заявки" (
                "заявка_id", "товар_id", "количество", "цена", "ндс_id", "способ_обеспечения"
            ) VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                orderId,
                productId,
                quantity,
                normalizeNumber(position.price ?? position.цена) ?? 0,
                normalizeInteger(position.vat_id ?? position.ндс_id) ?? 5,
                normalizeString(position.supply_mode ?? position.способ_обеспечения) ?? 'auto',
            ]
        );
    }
};

const replacePurchasePositions = async (
    queryable: Queryable,
    purchaseId: number,
    positions: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public."Позиции_закупки" WHERE "закупка_id" = $1', [purchaseId]);
    for (const position of positions) {
        const productId = normalizeInteger(position.product_id ?? position.товар_id);
        const quantity = normalizeInteger(position.quantity ?? position.количество);
        if (productId == null || quantity == null) continue;
        await queryable.query(
            `
            INSERT INTO public."Позиции_закупки" (
                "закупка_id", "товар_id", "количество", "цена", "ндс_id"
            ) VALUES ($1, $2, $3, $4, $5)
            `,
            [
                purchaseId,
                productId,
                quantity,
                normalizeNumber(position.price ?? position.цена) ?? 0,
                normalizeInteger(position.vat_id ?? position.ндс_id) ?? 5,
            ]
        );
    }
};

const replaceShipmentPositions = async (
    queryable: Queryable,
    shipmentId: number,
    positions: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.shipment_positions WHERE shipment_id = $1', [shipmentId]);
    for (const position of positions) {
        const productId = normalizeInteger(position.product_id ?? position.товар_id);
        const quantity = normalizeInteger(position.quantity ?? position.количество);
        if (productId == null || quantity == null) continue;
        await queryable.query(
            `
            INSERT INTO public.shipment_positions (
                shipment_id, product_id, quantity, price, vat_id
            ) VALUES ($1, $2, $3, $4, $5)
            `,
            [
                shipmentId,
                productId,
                quantity,
                normalizeNumber(position.price ?? position.цена) ?? 0,
                normalizeInteger(position.vat_id ?? position.ндс_id) ?? 5,
            ]
        );
    }
};

const resolveProductId = async (queryable: Queryable, row: Record<string, unknown>) => {
    const explicitId = normalizeInteger(row.product_id ?? row.товар_id);
    if (explicitId != null) return explicitId;

    const article = normalizeString(row.product_article ?? row.артикул);
    if (!article) return null;

    const result = await queryable.query(
        'SELECT id FROM public."Товары" WHERE "артикул" = $1 LIMIT 1',
        [article]
    );
    if (result.rows.length === 0) return null;
    return Number(result.rows[0].id);
};

const replaceSupplierAssortment = async (
    queryable: Queryable,
    supplierId: number,
    assortment: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public."Ассортимент_поставщиков" WHERE "поставщик_id" = $1', [supplierId]);

    let needSequenceSync = false;

    for (const item of assortment) {
        const productId = await resolveProductId(queryable, item);
        if (productId == null) continue;

        const assortmentId = normalizeInteger(item.id);
        const price = normalizeNumber(item.price ?? item.цена) ?? 0;
        const leadTime = normalizeInteger(item.lead_time_days ?? item.срок_поставки) ?? 1;

        if (assortmentId != null) {
            await queryable.query(
                `
                INSERT INTO public."Ассортимент_поставщиков" (
                    id, "поставщик_id", "товар_id", "цена", "срок_поставки"
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                    "поставщик_id" = EXCLUDED."поставщик_id",
                    "товар_id" = EXCLUDED."товар_id",
                    "цена" = EXCLUDED."цена",
                    "срок_поставки" = EXCLUDED."срок_поставки"
                `,
                [assortmentId, supplierId, productId, price, leadTime]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public."Ассортимент_поставщиков" (
                    "поставщик_id", "товар_id", "цена", "срок_поставки"
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT ("поставщик_id", "товар_id") DO UPDATE SET
                    "цена" = EXCLUDED."цена",
                    "срок_поставки" = EXCLUDED."срок_поставки"
                `,
                [supplierId, productId, price, leadTime]
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public."Ассортимент_поставщиков"');
    }
};

const replaceEmployeeIdentityDocuments = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_identity_documents WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeString(row.document_type) ?? normalizeString(row.documentType),
            normalizeString(row.series_number) ?? normalizeString(row.seriesNumber),
            normalizeString(row.issued_by) ?? normalizeString(row.issuedBy),
            normalizeString(row.department_code) ?? normalizeString(row.departmentCode),
            normalizeDate(row.issue_date) ?? normalizeDate(row.issueDate),
            normalizeDate(row.valid_until) ?? normalizeDate(row.validUntil),
            normalizeBoolean(row.is_primary) ?? normalizeBoolean(row.isPrimary) ?? false,
        ];
        if (!payload[1]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_identity_documents (
                    id, employee_id, document_type, series_number, issued_by, department_code,
                    issue_date, valid_until, is_primary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_identity_documents (
                    employee_id, document_type, series_number, issued_by, department_code,
                    issue_date, valid_until, is_primary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_identity_documents');
    }
};

const replaceEmployeeEmploymentEvents = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_employment_events WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeDate(row.event_date),
            normalizeString(row.event_type) ?? normalizeString(row.eventType),
            normalizeString(row.details),
            normalizeString(row.status),
            normalizeDate(row.sent_date) ?? normalizeDate(row.sentDate),
            normalizeString(row.external_uuid),
        ];
        if (!payload[2]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_employment_events (
                    id, employee_id, event_date, event_type, details, status, sent_date, external_uuid
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::uuid, gen_random_uuid()))
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_employment_events (
                    employee_id, event_date, event_type, details, status, sent_date, external_uuid
                ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::uuid, gen_random_uuid()))
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_employment_events');
    }
};

const replaceEmployeeRelatives = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_relatives WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeString(row.full_name) ?? normalizeString(row.fullName),
            normalizeString(row.relation_type) ?? normalizeString(row.relationType),
            normalizeDate(row.birth_date) ?? normalizeDate(row.birthDate),
            normalizeString(row.document_info) ?? normalizeString(row.documentInfo),
            normalizeString(row.snils),
            normalizeString(row.phone),
            normalizeString(row.notes),
        ];
        if (!payload[1]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_relatives (
                    id, employee_id, full_name, relation_type, birth_date, document_info, snils, phone, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_relatives (
                    employee_id, full_name, relation_type, birth_date, document_info, snils, phone, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_relatives');
    }
};

const replaceEmployeeMilitaryDocuments = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_military_documents WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeString(row.document_type) ?? normalizeString(row.documentType),
            normalizeString(row.series_number) ?? normalizeString(row.seriesNumber),
            normalizeString(row.issued_by) ?? normalizeString(row.issuedBy),
            normalizeDate(row.issue_date) ?? normalizeDate(row.issueDate),
            normalizeDate(row.valid_until) ?? normalizeDate(row.validUntil),
        ];
        if (!payload[1]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_military_documents (
                    id, employee_id, document_type, series_number, issued_by, issue_date, valid_until
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_military_documents (
                    employee_id, document_type, series_number, issued_by, issue_date, valid_until
                ) VALUES ($1, $2, $3, $4, $5, $6)
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_military_documents');
    }
};

const replaceEmployeeSchedulePatterns = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_schedule_patterns WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeString(row.name),
            normalizeString(row.pattern_type) ?? 'custom',
            JSON.stringify(parseJsonCell(row.cycle_schema, [])),
            normalizeDate(row.anchor_date),
            normalizeDate(row.date_from),
            normalizeDate(row.date_to),
            normalizeString(row.shift_start),
            normalizeString(row.shift_end),
            normalizeBoolean(row.respect_production_calendar) ?? false,
            normalizeBoolean(row.shorten_preholiday) ?? false,
            normalizeBoolean(row.is_active) ?? true,
            normalizeInteger(row.created_by_user_id),
            normalizeInteger(row.updated_by_user_id),
            normalizeDateTime(row.created_at),
            normalizeDateTime(row.updated_at),
        ];
        if (!payload[1] || !payload[4] || !payload[5]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_schedule_patterns (
                    id, employee_id, name, pattern_type, cycle_schema, anchor_date, date_from, date_to,
                    shift_start, shift_end, respect_production_calendar, shorten_preholiday, is_active,
                    created_by_user_id, updated_by_user_id, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5::jsonb, $6, $7, $8,
                    $9::time, $10::time, $11, $12, $13,
                    $14, $15, COALESCE($16::timestamp, CURRENT_TIMESTAMP), COALESCE($17::timestamp, CURRENT_TIMESTAMP)
                )
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_schedule_patterns (
                    employee_id, name, pattern_type, cycle_schema, anchor_date, date_from, date_to,
                    shift_start, shift_end, respect_production_calendar, shorten_preholiday, is_active,
                    created_by_user_id, updated_by_user_id, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4::jsonb, $5, $6, $7,
                    $8::time, $9::time, $10, $11, $12,
                    $13, $14, COALESCE($15::timestamp, CURRENT_TIMESTAMP), COALESCE($16::timestamp, CURRENT_TIMESTAMP)
                )
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_schedule_patterns');
    }
};

const replaceEmployeeVacations = async (
    queryable: Queryable,
    employeeId: number,
    rows: Array<Record<string, unknown>>
) => {
    await queryable.query('DELETE FROM public.employee_vacations WHERE employee_id = $1', [employeeId]);
    let needSequenceSync = false;

    for (const row of rows) {
        const explicitId = normalizeInteger(row.id);
        const payload = [
            employeeId,
            normalizeDate(row.date_from),
            normalizeDate(row.date_to),
            normalizeString(row.vacation_type) ?? 'annual',
            normalizeString(row.status) ?? 'planned',
            normalizeString(row.comment),
            normalizeInteger(row.created_by_user_id),
            normalizeInteger(row.updated_by_user_id),
            normalizeDateTime(row.created_at),
            normalizeDateTime(row.updated_at),
        ];
        if (!payload[1] || !payload[2]) continue;

        if (explicitId != null) {
            await queryable.query(
                `
                INSERT INTO public.employee_vacations (
                    id, employee_id, date_from, date_to, vacation_type, status, comment,
                    created_by_user_id, updated_by_user_id, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, COALESCE($10::timestamp, CURRENT_TIMESTAMP), COALESCE($11::timestamp, CURRENT_TIMESTAMP)
                )
                `,
                [explicitId, ...payload]
            );
            needSequenceSync = true;
        } else {
            await queryable.query(
                `
                INSERT INTO public.employee_vacations (
                    employee_id, date_from, date_to, vacation_type, status, comment,
                    created_by_user_id, updated_by_user_id, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, COALESCE($9::timestamp, CURRENT_TIMESTAMP), COALESCE($10::timestamp, CURRENT_TIMESTAMP)
                )
                `,
                payload
            );
        }
    }

    if (needSequenceSync) {
        await ensureSequence(queryable, 'public.employee_vacations');
    }
};

const registry: Record<DataExchangeCatalogKey, DataExchangeRegistryEntry> = {
    products: {
        key: 'products',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    t.id,
                    t."название",
                    t."артикул",
                    t."категория_id",
                    c."название" AS категория_название,
                    t."категория",
                    t."цена_закупки",
                    t."цена_продажи",
                    t."единица_измерения",
                    t."минимальный_остаток",
                    t."тип_номенклатуры",
                    t."счет_учета",
                    t."счет_затрат",
                    t."ндс_id",
                    t."комментарий",
                    t.created_at
                FROM public."Товары" t
                LEFT JOIN public."Категории_товаров" c ON c.id = t."категория_id"
                ORDER BY t.id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            const categoriesRes = await queryable.query('SELECT id, "название" FROM public."Категории_товаров"');
            const categoryIdByName = new Map<string, number>();
            const categoryIds = new Set<number>();
            for (const row of categoriesRes.rows) {
                categoryIds.add(Number(row.id));
                if (row.название) categoryIdByName.set(String(row.название).trim().toLowerCase(), Number(row.id));
            }

            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const article = normalizeString(row.артикул);
                const name = normalizeString(row.название);
                if (!article || !name) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка товара без артикула или названия.');
                    continue;
                }

                let categoryId = normalizeInteger(row.категория_id);
                const categoryName = normalizeString(row.категория_название ?? row.категория);
                if ((categoryId == null || !categoryIds.has(categoryId)) && categoryName) {
                    categoryId = categoryIdByName.get(categoryName.toLowerCase()) ?? null;
                }

                const buyPrice = normalizeNumber(row.цена_закупки);
                const salePrice = normalizeNumber(row.цена_продажи);
                const minStock = normalizeInteger(row.минимальный_остаток) ?? 0;
                const unit = normalizeString(row.единица_измерения) ?? 'шт';
                const nomenclatureType = normalizeString(row.тип_номенклатуры) ?? 'товар';
                const account = normalizeString(row.счет_учета);
                const expenseAccount = normalizeString(row.счет_затрат);
                const vatId = normalizeInteger(row.ндс_id) ?? 5;
                const comment = normalizeString(row.комментарий);

                const existing = id != null
                    ? await queryable.query(
                        `
                        SELECT id, "цена_закупки", "цена_продажи"
                        FROM public."Товары"
                        WHERE id = $1 OR "артикул" = $2
                        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                        LIMIT 1
                        `,
                        [id, article]
                    )
                    : await queryable.query('SELECT id, "цена_закупки", "цена_продажи" FROM public."Товары" WHERE "артикул" = $1 LIMIT 1', [article]);

                if (existing.rows.length > 0) {
                    const existingId = Number(existing.rows[0].id);
                    await queryable.query(
                        `
                        UPDATE public."Товары"
                        SET
                            "название" = $1,
                            "артикул" = $2,
                            "категория_id" = $3,
                            "категория" = $4,
                            "цена_закупки" = $5,
                            "цена_продажи" = $6,
                            "единица_измерения" = $7,
                            "минимальный_остаток" = $8,
                            "тип_номенклатуры" = $9,
                            "счет_учета" = $10,
                            "счет_затрат" = $11,
                            "ндс_id" = $12,
                            "комментарий" = $13
                        WHERE id = $14
                        `,
                        [
                            name,
                            article,
                            categoryId,
                            categoryName,
                            buyPrice,
                            salePrice,
                            unit,
                            minStock,
                            nomenclatureType,
                            account,
                            expenseAccount,
                            vatId,
                            comment,
                            existingId,
                        ]
                    );

                    const prevBuy = existing.rows[0].цена_закупки == null ? null : Number(existing.rows[0].цена_закупки);
                    const prevSell = existing.rows[0].цена_продажи == null ? null : Number(existing.rows[0].цена_продажи);
                    if (prevBuy !== buyPrice || prevSell !== salePrice) {
                        await queryable.query(
                            `
                            INSERT INTO public."История_цен_товаров" (
                                "товар_id", "цена_закупки", "цена_продажи", "источник", "комментарий"
                            ) VALUES ($1, $2, $3, $4, $5)
                            `,
                            [existingId, buyPrice, salePrice, 'data_exchange_import', 'Импорт справочника товаров']
                        );
                    }
                    summary.updated += 1;
                } else {
                    const hasExplicitId = id != null;
                    const insertSql = hasExplicitId
                        ? `
                        INSERT INTO public."Товары" (
                            id, "название", "артикул", "категория_id", "категория", "цена_закупки",
                            "цена_продажи", "единица_измерения", "минимальный_остаток", "тип_номенклатуры",
                            "счет_учета", "счет_затрат", "ндс_id", "комментарий"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        RETURNING id
                        `
                        : `
                        INSERT INTO public."Товары" (
                            "название", "артикул", "категория_id", "категория", "цена_закупки",
                            "цена_продажи", "единица_измерения", "минимальный_остаток", "тип_номенклатуры",
                            "счет_учета", "счет_затрат", "ндс_id", "комментарий"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        RETURNING id
                        `;
                    const insertParams = hasExplicitId
                        ? [id, name, article, categoryId, categoryName, buyPrice, salePrice, unit, minStock, nomenclatureType, account, expenseAccount, vatId, comment]
                        : [name, article, categoryId, categoryName, buyPrice, salePrice, unit, minStock, nomenclatureType, account, expenseAccount, vatId, comment];
                    const created = await queryable.query(insertSql, insertParams);
                    const createdId = Number(created.rows[0].id);
                    await queryable.query(
                        `
                        INSERT INTO public."История_цен_товаров" (
                            "товар_id", "цена_закупки", "цена_продажи", "источник", "комментарий"
                        ) VALUES ($1, $2, $3, $4, $5)
                        `,
                        [createdId, buyPrice, salePrice, 'data_exchange_import', 'Импорт справочника товаров']
                    );
                    summary.created += 1;
                    if (hasExplicitId) needSequenceSync = true;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Товары"');
            }

            return summary;
        },
    },
    categories: {
        key: 'categories',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    c.id,
                    c."название",
                    c."описание",
                    c."родительская_категория_id",
                    p."название" AS родительская_категория_название,
                    c."активна",
                    c.created_at
                FROM public."Категории_товаров" c
                LEFT JOIN public."Категории_товаров" p ON p.id = c."родительская_категория_id"
                ORDER BY c.id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            const existingRes = await queryable.query('SELECT id, "название" FROM public."Категории_товаров"');
            const idByName = new Map<string, number>();
            const knownIds = new Set<number>();
            for (const row of existingRes.rows) {
                const id = Number(row.id);
                knownIds.add(id);
                idByName.set(String(row.название).trim().toLowerCase(), id);
            }

            const pending = rows
                .map((row) => ({
                    raw: row,
                    id: normalizeInteger(row.id),
                    name: normalizeString(row.название),
                    description: normalizeString(row.описание),
                    parentId: normalizeInteger(row.родительская_категория_id),
                    parentName: normalizeString(row.родительская_категория_название),
                    active: normalizeBoolean(row.активна),
                }))
                .filter((row) => row.name);

            let needSequenceSync = false;
            let progress = true;

            while (pending.length > 0 && progress) {
                progress = false;

                for (let index = pending.length - 1; index >= 0; index -= 1) {
                    const item = pending[index];
                    let resolvedParentId = item.parentId;
                    if (resolvedParentId != null && !knownIds.has(resolvedParentId)) {
                        resolvedParentId = null;
                    }
                    if (resolvedParentId == null && item.parentName) {
                        resolvedParentId = idByName.get(item.parentName.toLowerCase()) ?? null;
                    }

                    const parentWasRequested = item.parentId != null || Boolean(item.parentName);
                    if (parentWasRequested && resolvedParentId == null) {
                        continue;
                    }

                    const existing = item.id != null
                        ? await queryable.query(
                            `
                            SELECT id
                            FROM public."Категории_товаров"
                            WHERE id = $1 OR LOWER("название") = LOWER($2)
                            ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                            LIMIT 1
                            `,
                            [item.id, item.name]
                        )
                        : await queryable.query('SELECT id FROM public."Категории_товаров" WHERE LOWER("название") = LOWER($1) LIMIT 1', [item.name]);

                    if (existing.rows.length > 0) {
                        const existingId = Number(existing.rows[0].id);
                        await queryable.query(
                            `
                            UPDATE public."Категории_товаров"
                            SET
                                "название" = $1,
                                "описание" = $2,
                                "родительская_категория_id" = $3,
                                "активна" = COALESCE($4, "активна")
                            WHERE id = $5
                            `,
                            [item.name, item.description, resolvedParentId, item.active, existingId]
                        );
                        summary.updated += 1;
                        knownIds.add(existingId);
                        idByName.set(String(item.name).toLowerCase(), existingId);
                    } else {
                        const hasExplicitId = item.id != null;
                        const insertSql = hasExplicitId
                            ? `
                            INSERT INTO public."Категории_товаров" (
                                id, "название", "описание", "родительская_категория_id", "активна"
                            ) VALUES ($1, $2, $3, $4, $5)
                            RETURNING id
                            `
                            : `
                            INSERT INTO public."Категории_товаров" (
                                "название", "описание", "родительская_категория_id", "активна"
                            ) VALUES ($1, $2, $3, $4)
                            RETURNING id
                            `;
                        const insertParams = hasExplicitId
                            ? [item.id, item.name, item.description, resolvedParentId, item.active ?? true]
                            : [item.name, item.description, resolvedParentId, item.active ?? true];
                        const inserted = await queryable.query(insertSql, insertParams);
                        const createdId = Number(inserted.rows[0].id);
                        summary.created += 1;
                        knownIds.add(createdId);
                        idByName.set(String(item.name).toLowerCase(), createdId);
                        if (hasExplicitId) needSequenceSync = true;
                    }

                    pending.splice(index, 1);
                    progress = true;
                }
            }

            for (const item of pending) {
                summary.skipped += 1;
                summary.warnings.push(`Категория "${item.name}" пропущена: не найден родитель "${item.parentName}".`);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Категории_товаров"');
            }

            return summary;
        },
    },
    clients: {
        key: 'clients',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    c.*,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', ba.id,
                                    'name', ba."название",
                                    'bik', ba."бик",
                                    'bankName', ba."банк",
                                    'correspondentAccount', ba."к_с",
                                    'settlementAccount', ba."р_с",
                                    'isPrimary', ba."основной",
                                    'sortOrder', ba.sort_order
                                )
                                ORDER BY ba."основной" DESC, ba.sort_order ASC, ba.id ASC
                            )
                            FROM public."Расчетные_счета_клиентов" ba
                            WHERE ba."клиент_id" = c.id
                        ),
                        '[]'::jsonb
                    ) AS bank_accounts
                FROM public."Клиенты" c
                ORDER BY c.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                bank_accounts: JSON.stringify(row.bank_accounts ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const name = normalizeString(row.название);
                if (!name) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка контрагента без названия.');
                    continue;
                }

                const bankAccounts = parseJsonCell<Array<Record<string, unknown>>>(row.bank_accounts ?? row.bankAccounts, []);
                const payload = [
                    name,
                    normalizeString(row.телефон),
                    normalizeString(row.email),
                    normalizeString(row.адрес),
                    normalizeString(row.тип) ?? 'Организация',
                    normalizeString(row.краткое_название ?? row.краткоеНазвание),
                    normalizeString(row.полное_название ?? row.полноеНазвание),
                    normalizeString(row.фамилия),
                    normalizeString(row.имя),
                    normalizeString(row.отчество),
                    normalizeString(row.инн),
                    normalizeString(row.кпп),
                    normalizeString(row.огрн),
                    normalizeString(row.огрнип),
                    normalizeString(row.окпо),
                    normalizeString(row.адрес_регистрации ?? row.адресРегистрации),
                    normalizeString(row.адрес_печати ?? row.адресПечати),
                    normalizeString(row.паспорт_серия ?? row.паспортСерия),
                    normalizeString(row.паспорт_номер ?? row.паспортНомер),
                    normalizeString(row.паспорт_кем_выдан ?? row.паспортКемВыдан),
                    normalizeDate(row.паспорт_дата_выдачи ?? row.паспортДатаВыдачи),
                    normalizeString(row.паспорт_код_подразделения ?? row.паспортКодПодразделения),
                    normalizeString(row.комментарий),
                ];

                const existing = id != null
                    ? await queryable.query(
                        `
                        SELECT id
                        FROM public."Клиенты"
                        WHERE id = $1 OR "название" = $2
                        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                        LIMIT 1
                        `,
                        [id, name]
                    )
                    : await queryable.query('SELECT id FROM public."Клиенты" WHERE "название" = $1 LIMIT 1', [name]);

                let targetId: number;
                if (existing.rows.length > 0) {
                    targetId = Number(existing.rows[0].id);
                    await queryable.query(
                        `
                        UPDATE public."Клиенты"
                        SET
                            "название" = $1,
                            "телефон" = $2,
                            email = $3,
                            "адрес" = $4,
                            "тип" = $5,
                            "краткое_название" = $6,
                            "полное_название" = $7,
                            "фамилия" = $8,
                            "имя" = $9,
                            "отчество" = $10,
                            "инн" = $11,
                            "кпп" = $12,
                            "огрн" = $13,
                            "огрнип" = $14,
                            "окпо" = $15,
                            "адрес_регистрации" = $16,
                            "адрес_печати" = $17,
                            "паспорт_серия" = $18,
                            "паспорт_номер" = $19,
                            "паспорт_кем_выдан" = $20,
                            "паспорт_дата_выдачи" = $21,
                            "паспорт_код_подразделения" = $22,
                            "комментарий" = $23
                        WHERE id = $24
                        `,
                        [...payload, targetId]
                    );
                    summary.updated += 1;
                } else {
                    const hasExplicitId = id != null;
                    const insertSql = hasExplicitId
                        ? `
                        INSERT INTO public."Клиенты" (
                            id, "название", "телефон", email, "адрес", "тип", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8,
                            $9, $10, $11, $12, $13, $14, $15, $16,
                            $17, $18, $19, $20, $21, $22, $23, $24
                        )
                        RETURNING id
                        `
                        : `
                        INSERT INTO public."Клиенты" (
                            "название", "телефон", email, "адрес", "тип", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13, $14, $15,
                            $16, $17, $18, $19, $20, $21, $22, $23
                        )
                        RETURNING id
                        `;
                    const inserted = await queryable.query(insertSql, hasExplicitId ? [id, ...payload] : payload);
                    targetId = Number(inserted.rows[0].id);
                    summary.created += 1;
                    if (hasExplicitId) needSequenceSync = true;
                }

                await replaceClientBankAccounts(queryable, targetId, bankAccounts);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Клиенты"');
            }

            return summary;
        },
    },
    suppliers: {
        key: 'suppliers',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    s.*,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', ba.id,
                                    'name', ba."название",
                                    'bik', ba."бик",
                                    'bankName', ba."банк",
                                    'correspondentAccount', ba."к_с",
                                    'settlementAccount', ba."р_с",
                                    'isPrimary', ba."основной",
                                    'sortOrder', ba.sort_order
                                )
                                ORDER BY ba."основной" DESC, ba.sort_order ASC, ba.id ASC
                            )
                            FROM public."Расчетные_счета_поставщиков" ba
                            WHERE ba."поставщик_id" = s.id
                        ),
                        '[]'::jsonb
                    ) AS bank_accounts,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', sa.id,
                                    'product_id', sa."товар_id",
                                    'product_article', t."артикул",
                                    'product_name', t."название",
                                    'price', sa."цена",
                                    'lead_time_days', sa."срок_поставки"
                                )
                                ORDER BY sa.id
                            )
                            FROM public."Ассортимент_поставщиков" sa
                            LEFT JOIN public."Товары" t ON t.id = sa."товар_id"
                            WHERE sa."поставщик_id" = s.id
                        ),
                        '[]'::jsonb
                    ) AS assortment_json
                FROM public."Поставщики" s
                ORDER BY s.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                bank_accounts: JSON.stringify(row.bank_accounts ?? []),
                assortment_json: JSON.stringify(row.assortment_json ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const name = normalizeString(row.название);
                if (!name) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка поставщика без названия.');
                    continue;
                }

                const bankAccounts = parseJsonCell<Array<Record<string, unknown>>>(row.bank_accounts ?? row.bankAccounts, []);
                const assortment = parseJsonCell<Array<Record<string, unknown>>>(row.assortment_json ?? row.assortment, []);
                const payload = [
                    name,
                    normalizeString(row.телефон),
                    normalizeString(row.email),
                    normalizeString(row.тип) ?? 'Организация',
                    normalizeInteger(row.рейтинг) ?? 5,
                    normalizeString(row.краткое_название ?? row.краткоеНазвание),
                    normalizeString(row.полное_название ?? row.полноеНазвание),
                    normalizeString(row.фамилия),
                    normalizeString(row.имя),
                    normalizeString(row.отчество),
                    normalizeString(row.инн),
                    normalizeString(row.кпп),
                    normalizeString(row.огрн),
                    normalizeString(row.огрнип),
                    normalizeString(row.окпо),
                    normalizeString(row.адрес_регистрации ?? row.адресРегистрации),
                    normalizeString(row.адрес_печати ?? row.адресПечати),
                    normalizeString(row.паспорт_серия ?? row.паспортСерия),
                    normalizeString(row.паспорт_номер ?? row.паспортНомер),
                    normalizeString(row.паспорт_кем_выдан ?? row.паспортКемВыдан),
                    normalizeDate(row.паспорт_дата_выдачи ?? row.паспортДатаВыдачи),
                    normalizeString(row.паспорт_код_подразделения ?? row.паспортКодПодразделения),
                    normalizeString(row.комментарий),
                ];

                const existing = id != null
                    ? await queryable.query(
                        `
                        SELECT id
                        FROM public."Поставщики"
                        WHERE id = $1 OR "название" = $2
                        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                        LIMIT 1
                        `,
                        [id, name]
                    )
                    : await queryable.query('SELECT id FROM public."Поставщики" WHERE "название" = $1 LIMIT 1', [name]);

                let targetId: number;
                if (existing.rows.length > 0) {
                    targetId = Number(existing.rows[0].id);
                    await queryable.query(
                        `
                        UPDATE public."Поставщики"
                        SET
                            "название" = $1,
                            "телефон" = $2,
                            email = $3,
                            "тип" = $4,
                            "рейтинг" = $5,
                            "краткое_название" = $6,
                            "полное_название" = $7,
                            "фамилия" = $8,
                            "имя" = $9,
                            "отчество" = $10,
                            "инн" = $11,
                            "кпп" = $12,
                            "огрн" = $13,
                            "огрнип" = $14,
                            "окпо" = $15,
                            "адрес_регистрации" = $16,
                            "адрес_печати" = $17,
                            "паспорт_серия" = $18,
                            "паспорт_номер" = $19,
                            "паспорт_кем_выдан" = $20,
                            "паспорт_дата_выдачи" = $21,
                            "паспорт_код_подразделения" = $22,
                            "комментарий" = $23
                        WHERE id = $24
                        `,
                        [...payload, targetId]
                    );
                    summary.updated += 1;
                } else {
                    const hasExplicitId = id != null;
                    const insertSql = hasExplicitId
                        ? `
                        INSERT INTO public."Поставщики" (
                            id, "название", "телефон", email, "тип", "рейтинг", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8,
                            $9, $10, $11, $12, $13, $14, $15, $16,
                            $17, $18, $19, $20, $21, $22, $23, $24
                        )
                        RETURNING id
                        `
                        : `
                        INSERT INTO public."Поставщики" (
                            "название", "телефон", email, "тип", "рейтинг", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13, $14, $15,
                            $16, $17, $18, $19, $20, $21, $22, $23
                        )
                        RETURNING id
                        `;
                    const inserted = await queryable.query(insertSql, hasExplicitId ? [id, ...payload] : payload);
                    targetId = Number(inserted.rows[0].id);
                    summary.created += 1;
                    if (hasExplicitId) needSequenceSync = true;
                }

                await replaceSupplierBankAccounts(queryable, targetId, bankAccounts);
                await replaceSupplierAssortment(queryable, targetId, assortment);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Поставщики"');
            }

            return summary;
        },
    },
    transport: {
        key: 'transport',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT id, "название", "телефон", email, "тариф", created_at
                FROM public."Транспортные_компании"
                ORDER BY id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const name = normalizeString(row.название);
                if (!name) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка ТК без названия.');
                    continue;
                }

                const phone = normalizeString(row.телефон);
                const email = normalizeString(row.email);
                const tariff = normalizeNumber(row.тариф);

                const existing = id != null
                    ? await queryable.query(
                        `
                        SELECT id
                        FROM public."Транспортные_компании"
                        WHERE id = $1 OR "название" = $2
                        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                        LIMIT 1
                        `,
                        [id, name]
                    )
                    : await queryable.query('SELECT id FROM public."Транспортные_компании" WHERE "название" = $1 LIMIT 1', [name]);

                if (existing.rows.length > 0) {
                    await queryable.query(
                        `
                        UPDATE public."Транспортные_компании"
                        SET "название" = $1, "телефон" = $2, email = $3, "тариф" = $4
                        WHERE id = $5
                        `,
                        [name, phone, email, tariff, Number(existing.rows[0].id)]
                    );
                    summary.updated += 1;
                } else {
                    const hasExplicitId = id != null;
                    const inserted = await queryable.query(
                        hasExplicitId
                            ? `
                              INSERT INTO public."Транспортные_компании" (id, "название", "телефон", email, "тариф")
                              VALUES ($1, $2, $3, $4, $5)
                              RETURNING id
                              `
                            : `
                              INSERT INTO public."Транспортные_компании" ("название", "телефон", email, "тариф")
                              VALUES ($1, $2, $3, $4)
                              RETURNING id
                              `,
                        hasExplicitId ? [id, name, phone, email, tariff] : [name, phone, email, tariff]
                    );
                    void inserted;
                    summary.created += 1;
                    if (hasExplicitId) needSequenceSync = true;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Транспортные_компании"');
            }

            return summary;
        },
    },
    managers: {
        key: 'managers',
        exportRows: async (queryable) => {
            const employeesRes = await queryable.query(
                `
                SELECT id, "фио", "должность", "телефон", email, "ставка", "дата_приема", "активен", created_at
                FROM public."Сотрудники"
                ORDER BY id DESC
                `
            );
            const rows = await Promise.all(employeesRes.rows.map(async (employee) => {
                const employeeId = Number(employee.id);
                const [
                    profileRes,
                    bankDetailsRes,
                    employmentDetailsRes,
                    militaryRecordRes,
                    identityDocsRes,
                    employmentEventsRes,
                    relativesRes,
                    militaryDocsRes,
                    schedulePatternsRes,
                    vacationsRes,
                ] = await Promise.all([
                    queryable.query('SELECT * FROM public.employee_profiles WHERE employee_id = $1 LIMIT 1', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_bank_details WHERE employee_id = $1 LIMIT 1', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_employment_details WHERE employee_id = $1 LIMIT 1', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_military_records WHERE employee_id = $1 LIMIT 1', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_identity_documents WHERE employee_id = $1 ORDER BY id', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_employment_events WHERE employee_id = $1 ORDER BY id', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_relatives WHERE employee_id = $1 ORDER BY id', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_military_documents WHERE employee_id = $1 ORDER BY id', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_schedule_patterns WHERE employee_id = $1 ORDER BY id', [employeeId]),
                    queryable.query('SELECT * FROM public.employee_vacations WHERE employee_id = $1 ORDER BY id', [employeeId]),
                ]);

                return {
                    ...employee,
                    profile_json: JSON.stringify(profileRes.rows[0] ?? null),
                    bank_details_json: JSON.stringify(bankDetailsRes.rows[0] ?? null),
                    employment_details_json: JSON.stringify(employmentDetailsRes.rows[0] ?? null),
                    military_record_json: JSON.stringify(militaryRecordRes.rows[0] ?? null),
                    identity_documents_json: JSON.stringify(identityDocsRes.rows),
                    employment_events_json: JSON.stringify(employmentEventsRes.rows),
                    relatives_json: JSON.stringify(relativesRes.rows),
                    military_documents_json: JSON.stringify(militaryDocsRes.rows),
                    schedule_patterns_json: JSON.stringify(schedulePatternsRes.rows),
                    vacations_json: JSON.stringify(vacationsRes.rows),
                };
            }));

            return rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const fio = normalizeString(row.фио);
                const position = normalizeString(row.должность);
                if (!fio || !position) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка сотрудника без ФИО или должности.');
                    continue;
                }

                const phone = normalizeString(row.телефон);
                const email = normalizeString(row.email);
                const salary = normalizeNumber(row.ставка);
                const hireDate = normalizeDate(row.дата_приема);
                const isActive = normalizeBoolean(row.активен);
                const profile = parseJsonCell<Record<string, unknown> | null>(row.profile_json ?? row.profile, null);
                const bankDetails = parseJsonCell<Record<string, unknown> | null>(row.bank_details_json ?? row.bankDetails, null);
                const employmentDetails = parseJsonCell<Record<string, unknown> | null>(row.employment_details_json ?? row.employmentDetails, null);
                const militaryRecord = parseJsonCell<Record<string, unknown> | null>(row.military_record_json ?? row.militaryRecord, null);
                const identityDocuments = parseJsonCell<Array<Record<string, unknown>>>(row.identity_documents_json ?? row.identityDocuments, []);
                const employmentEvents = parseJsonCell<Array<Record<string, unknown>>>(row.employment_events_json ?? row.employmentEvents, []);
                const relatives = parseJsonCell<Array<Record<string, unknown>>>(row.relatives_json ?? row.relatives, []);
                const militaryDocuments = parseJsonCell<Array<Record<string, unknown>>>(row.military_documents_json ?? row.militaryDocuments, []);
                const schedulePatterns = parseJsonCell<Array<Record<string, unknown>>>(row.schedule_patterns_json ?? row.schedulePatterns, []);
                const vacations = parseJsonCell<Array<Record<string, unknown>>>(row.vacations_json ?? row.vacations, []);

                let employeeId: number;
                const existing = id != null
                    ? await queryable.query(
                        `
                        SELECT id
                        FROM public."Сотрудники"
                        WHERE id = $1 OR "фио" = $2
                        ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                        LIMIT 1
                        `,
                        [id, fio]
                    )
                    : await queryable.query('SELECT id FROM public."Сотрудники" WHERE "фио" = $1 LIMIT 1', [fio]);

                if (existing.rows.length > 0) {
                    employeeId = Number(existing.rows[0].id);
                    await queryable.query(
                        `
                        UPDATE public."Сотрудники"
                        SET
                            "фио" = $1,
                            "должность" = $2,
                            "телефон" = $3,
                            email = $4,
                            "ставка" = $5,
                            "дата_приема" = $6,
                            "активен" = COALESCE($7, "активен")
                        WHERE id = $8
                        `,
                        [fio, position, phone, email, salary, hireDate, isActive, employeeId]
                    );
                    summary.updated += 1;
                } else {
                    const hasExplicitId = id != null;
                    const inserted = await queryable.query(
                        hasExplicitId
                            ? `
                              INSERT INTO public."Сотрудники" (id, "фио", "должность", "телефон", email, "ставка", "дата_приема", "активен")
                              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                              RETURNING id
                              `
                            : `
                              INSERT INTO public."Сотрудники" ("фио", "должность", "телефон", email, "ставка", "дата_приема", "активен")
                              VALUES ($1, $2, $3, $4, $5, $6, $7)
                              RETURNING id
                              `,
                        hasExplicitId
                            ? [id, fio, position, phone, email, salary, hireDate, isActive ?? true]
                            : [fio, position, phone, email, salary, hireDate, isActive ?? true]
                    );
                    employeeId = Number(inserted.rows[0].id);
                    summary.created += 1;
                    if (hasExplicitId) needSequenceSync = true;
                }

                if (profile) {
                    await queryable.query(
                        `
                        INSERT INTO public.employee_profiles (
                            employee_id, last_name, first_name, middle_name, gender, birth_date, birth_place,
                            marital_status, marital_status_since, snils, inn, taxpayer_status, citizenship_code,
                            citizenship_label, registration_address, registration_date, actual_address_same_as_registration,
                            actual_address, actual_address_since, personal_email, work_email, primary_phone, work_phone,
                            education_level, primary_profession, secondary_profession, languages, notes
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13,
                            $14, $15, $16, $17,
                            $18, $19, $20, $21, $22, $23,
                            $24, $25, $26, $27::text[], $28
                        )
                        ON CONFLICT (employee_id) DO UPDATE SET
                            last_name = EXCLUDED.last_name,
                            first_name = EXCLUDED.first_name,
                            middle_name = EXCLUDED.middle_name,
                            gender = EXCLUDED.gender,
                            birth_date = EXCLUDED.birth_date,
                            birth_place = EXCLUDED.birth_place,
                            marital_status = EXCLUDED.marital_status,
                            marital_status_since = EXCLUDED.marital_status_since,
                            snils = EXCLUDED.snils,
                            inn = EXCLUDED.inn,
                            taxpayer_status = EXCLUDED.taxpayer_status,
                            citizenship_code = EXCLUDED.citizenship_code,
                            citizenship_label = EXCLUDED.citizenship_label,
                            registration_address = EXCLUDED.registration_address,
                            registration_date = EXCLUDED.registration_date,
                            actual_address_same_as_registration = EXCLUDED.actual_address_same_as_registration,
                            actual_address = EXCLUDED.actual_address,
                            actual_address_since = EXCLUDED.actual_address_since,
                            personal_email = EXCLUDED.personal_email,
                            work_email = EXCLUDED.work_email,
                            primary_phone = EXCLUDED.primary_phone,
                            work_phone = EXCLUDED.work_phone,
                            education_level = EXCLUDED.education_level,
                            primary_profession = EXCLUDED.primary_profession,
                            secondary_profession = EXCLUDED.secondary_profession,
                            languages = EXCLUDED.languages,
                            notes = EXCLUDED.notes,
                            updated_at = CURRENT_TIMESTAMP
                        `,
                        [
                            employeeId,
                            normalizeString(profile.last_name),
                            normalizeString(profile.first_name),
                            normalizeString(profile.middle_name),
                            normalizeString(profile.gender),
                            normalizeDate(profile.birth_date),
                            normalizeString(profile.birth_place),
                            normalizeString(profile.marital_status),
                            normalizeDate(profile.marital_status_since),
                            normalizeString(profile.snils),
                            normalizeString(profile.inn),
                            normalizeString(profile.taxpayer_status),
                            normalizeString(profile.citizenship_code),
                            normalizeString(profile.citizenship_label),
                            normalizeString(profile.registration_address),
                            normalizeDate(profile.registration_date),
                            normalizeBoolean(profile.actual_address_same_as_registration) ?? true,
                            normalizeString(profile.actual_address),
                            normalizeDate(profile.actual_address_since),
                            normalizeString(profile.personal_email),
                            normalizeString(profile.work_email),
                            normalizeString(profile.primary_phone),
                            normalizeString(profile.work_phone),
                            normalizeString(profile.education_level),
                            normalizeString(profile.primary_profession),
                            normalizeString(profile.secondary_profession),
                            parseJsonCell(profile.languages, []).map((value) => String(value)),
                            normalizeString(profile.notes),
                        ]
                    );
                } else {
                    await queryable.query('DELETE FROM public.employee_profiles WHERE employee_id = $1', [employeeId]);
                }

                if (bankDetails) {
                    await queryable.query(
                        `
                        INSERT INTO public.employee_bank_details (
                            employee_id, bank_name, bank_bik, settlement_account, correspondent_account,
                            mir_card_number, alternative_bank_name, alternative_account_number, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (employee_id) DO UPDATE SET
                            bank_name = EXCLUDED.bank_name,
                            bank_bik = EXCLUDED.bank_bik,
                            settlement_account = EXCLUDED.settlement_account,
                            correspondent_account = EXCLUDED.correspondent_account,
                            mir_card_number = EXCLUDED.mir_card_number,
                            alternative_bank_name = EXCLUDED.alternative_bank_name,
                            alternative_account_number = EXCLUDED.alternative_account_number,
                            notes = EXCLUDED.notes,
                            updated_at = CURRENT_TIMESTAMP
                        `,
                        [
                            employeeId,
                            normalizeString(bankDetails.bank_name),
                            normalizeString(bankDetails.bank_bik),
                            normalizeString(bankDetails.settlement_account),
                            normalizeString(bankDetails.correspondent_account),
                            normalizeString(bankDetails.mir_card_number),
                            normalizeString(bankDetails.alternative_bank_name),
                            normalizeString(bankDetails.alternative_account_number),
                            normalizeString(bankDetails.notes),
                        ]
                    );
                } else {
                    await queryable.query('DELETE FROM public.employee_bank_details WHERE employee_id = $1', [employeeId]);
                }

                if (employmentDetails) {
                    await queryable.query(
                        `
                        INSERT INTO public.employee_employment_details (
                            employee_id, position_category, department_name, subdivision_name, is_flight_crew,
                            is_sea_crew, contract_type, labor_book_status, labor_book_notes, foreign_work_permit_note
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (employee_id) DO UPDATE SET
                            position_category = EXCLUDED.position_category,
                            department_name = EXCLUDED.department_name,
                            subdivision_name = EXCLUDED.subdivision_name,
                            is_flight_crew = EXCLUDED.is_flight_crew,
                            is_sea_crew = EXCLUDED.is_sea_crew,
                            contract_type = EXCLUDED.contract_type,
                            labor_book_status = EXCLUDED.labor_book_status,
                            labor_book_notes = EXCLUDED.labor_book_notes,
                            foreign_work_permit_note = EXCLUDED.foreign_work_permit_note,
                            updated_at = CURRENT_TIMESTAMP
                        `,
                        [
                            employeeId,
                            normalizeString(employmentDetails.position_category),
                            normalizeString(employmentDetails.department_name),
                            normalizeString(employmentDetails.subdivision_name),
                            normalizeBoolean(employmentDetails.is_flight_crew) ?? false,
                            normalizeBoolean(employmentDetails.is_sea_crew) ?? false,
                            normalizeString(employmentDetails.contract_type),
                            normalizeString(employmentDetails.labor_book_status),
                            normalizeString(employmentDetails.labor_book_notes),
                            normalizeString(employmentDetails.foreign_work_permit_note),
                        ]
                    );
                } else {
                    await queryable.query('DELETE FROM public.employee_employment_details WHERE employee_id = $1', [employeeId]);
                }

                if (militaryRecord) {
                    await queryable.query(
                        `
                        INSERT INTO public.employee_military_records (
                            employee_id, relation_to_service, reserve_category, military_rank, unit_composition,
                            specialty_code, fitness_category, fitness_checked_at, commissariat_name, commissariat_manual,
                            additional_info, military_registration_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (employee_id) DO UPDATE SET
                            relation_to_service = EXCLUDED.relation_to_service,
                            reserve_category = EXCLUDED.reserve_category,
                            military_rank = EXCLUDED.military_rank,
                            unit_composition = EXCLUDED.unit_composition,
                            specialty_code = EXCLUDED.specialty_code,
                            fitness_category = EXCLUDED.fitness_category,
                            fitness_checked_at = EXCLUDED.fitness_checked_at,
                            commissariat_name = EXCLUDED.commissariat_name,
                            commissariat_manual = EXCLUDED.commissariat_manual,
                            additional_info = EXCLUDED.additional_info,
                            military_registration_type = EXCLUDED.military_registration_type,
                            updated_at = CURRENT_TIMESTAMP
                        `,
                        [
                            employeeId,
                            normalizeString(militaryRecord.relation_to_service),
                            normalizeString(militaryRecord.reserve_category),
                            normalizeString(militaryRecord.military_rank),
                            normalizeString(militaryRecord.unit_composition),
                            normalizeString(militaryRecord.specialty_code),
                            normalizeString(militaryRecord.fitness_category),
                            normalizeDate(militaryRecord.fitness_checked_at),
                            normalizeString(militaryRecord.commissariat_name),
                            normalizeString(militaryRecord.commissariat_manual),
                            normalizeString(militaryRecord.additional_info),
                            normalizeString(militaryRecord.military_registration_type),
                        ]
                    );
                } else {
                    await queryable.query('DELETE FROM public.employee_military_records WHERE employee_id = $1', [employeeId]);
                }

                await replaceEmployeeIdentityDocuments(queryable, employeeId, identityDocuments);
                await replaceEmployeeEmploymentEvents(queryable, employeeId, employmentEvents);
                await replaceEmployeeRelatives(queryable, employeeId, relatives);
                await replaceEmployeeMilitaryDocuments(queryable, employeeId, militaryDocuments);
                await replaceEmployeeSchedulePatterns(queryable, employeeId, schedulePatterns);
                await replaceEmployeeVacations(queryable, employeeId, vacations);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Сотрудники"');
            }

            return summary;
        },
    },
    orders: {
        key: 'orders',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    o.*,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', p.id,
                                    'product_id', p."товар_id",
                                    'quantity', p."количество",
                                    'price', p."цена",
                                    'vat_id', p."ндс_id",
                                    'supply_mode', p."способ_обеспечения"
                                )
                                ORDER BY p.id
                            )
                            FROM public."Позиции_заявки" p
                            WHERE p."заявка_id" = o.id
                        ),
                        '[]'::jsonb
                    ) AS positions_json
                FROM public."Заявки" o
                ORDER BY o.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                positions_json: JSON.stringify(row.positions_json ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const clientId = normalizeInteger(row.клиент_id ?? row.client_id);
                if (clientId == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка заявки без клиента.');
                    continue;
                }

                const payload = [
                    clientId,
                    normalizeInteger(row.менеджер_id ?? row.manager_id),
                    normalizeDateTime(row.дата_создания ?? row.created_at),
                    normalizeDateTime(row.дата_выполнения ?? row.completed_at),
                    normalizeString(row.статус) ?? 'новая',
                    normalizeNumber(row.общая_сумма ?? row.total_amount) ?? 0,
                    normalizeString(row.адрес_доставки ?? row.delivery_address),
                    normalizeString(row.режим_исполнения ?? row.execution_mode) ?? 'warehouse',
                ];
                const positions = parseJsonCell<Array<Record<string, unknown>>>(row.positions_json ?? row.positions, []);

                let targetId: number;
                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Заявки" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        targetId = Number(existing.rows[0].id);
                        await queryable.query(
                            `
                            UPDATE public."Заявки"
                            SET
                                "клиент_id" = $1,
                                "менеджер_id" = $2,
                                "дата_создания" = COALESCE($3, "дата_создания"),
                                "дата_выполнения" = $4,
                                "статус" = $5,
                                "общая_сумма" = $6,
                                "адрес_доставки" = $7,
                                "режим_исполнения" = $8
                            WHERE id = $9
                            `,
                            [...payload, targetId]
                        );
                        summary.updated += 1;
                    } else {
                        const inserted = await queryable.query(
                            `
                            INSERT INTO public."Заявки" (
                                id, "клиент_id", "менеджер_id", "дата_создания", "дата_выполнения", "статус",
                                "общая_сумма", "адрес_доставки", "режим_исполнения"
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            RETURNING id
                            `,
                            [id, ...payload]
                        );
                        targetId = Number(inserted.rows[0].id);
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    const inserted = await queryable.query(
                        `
                        INSERT INTO public."Заявки" (
                            "клиент_id", "менеджер_id", "дата_создания", "дата_выполнения", "статус",
                            "общая_сумма", "адрес_доставки", "режим_исполнения"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        RETURNING id
                        `,
                        payload
                    );
                    targetId = Number(inserted.rows[0].id);
                    summary.created += 1;
                }

                await replaceOrderPositions(queryable, targetId, positions);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Заявки"');
            }

            return summary;
        },
    },
    missing_products: {
        key: 'missing_products',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    id,
                    "заявка_id",
                    "товар_id",
                    "необходимое_количество",
                    "недостающее_количество",
                    "статус",
                    "создано_в",
                    "закрыто_в",
                    "активна"
                FROM public."Недостающие_товары"
                ORDER BY id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const orderId = normalizeInteger(row.заявка_id ?? row.order_id);
                const productId = normalizeInteger(row.товар_id ?? row.product_id);
                if (orderId == null || productId == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка недостающего товара без заявки или товара.');
                    continue;
                }

                const payload = [
                    orderId,
                    productId,
                    normalizeInteger(row.необходимое_количество ?? row.required_quantity) ?? 0,
                    normalizeInteger(row.недостающее_количество ?? row.missing_quantity) ?? 0,
                    normalizeString(row.статус ?? row.status) ?? 'в обработке',
                    normalizeDateTime(row.создано_в ?? row.created_at),
                    normalizeDateTime(row.закрыто_в ?? row.closed_at),
                    normalizeBoolean(row.активна ?? row.is_active) ?? true,
                ];

                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Недостающие_товары" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        await queryable.query(
                            `
                            UPDATE public."Недостающие_товары"
                            SET
                                "заявка_id" = $1,
                                "товар_id" = $2,
                                "необходимое_количество" = $3,
                                "недостающее_количество" = $4,
                                "статус" = $5,
                                "создано_в" = COALESCE($6, "создано_в"),
                                "закрыто_в" = $7,
                                "активна" = $8
                            WHERE id = $9
                            `,
                            [...payload, id]
                        );
                        summary.updated += 1;
                    } else {
                        await queryable.query(
                            `
                            INSERT INTO public."Недостающие_товары" (
                                id, "заявка_id", "товар_id", "необходимое_количество", "недостающее_количество",
                                "статус", "создано_в", "закрыто_в", "активна"
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            `,
                            [id, ...payload]
                        );
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    await queryable.query(
                        `
                        INSERT INTO public."Недостающие_товары" (
                            "заявка_id", "товар_id", "необходимое_количество", "недостающее_количество",
                            "статус", "создано_в", "закрыто_в", "активна"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `,
                        payload
                    );
                    summary.created += 1;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Недостающие_товары"');
            }

            return summary;
        },
    },
    purchases: {
        key: 'purchases',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    p.*,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', pp.id,
                                    'product_id', pp."товар_id",
                                    'quantity', pp."количество",
                                    'price', pp."цена",
                                    'vat_id', pp."ндс_id"
                                )
                                ORDER BY pp.id
                            )
                            FROM public."Позиции_закупки" pp
                            WHERE pp."закупка_id" = p.id
                        ),
                        '[]'::jsonb
                    ) AS positions_json
                FROM public."Закупки" p
                ORDER BY p.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                positions_json: JSON.stringify(row.positions_json ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const supplierId = normalizeInteger(row.поставщик_id ?? row.supplier_id);
                if (supplierId == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка закупки без поставщика.');
                    continue;
                }

                const payload = [
                    supplierId,
                    normalizeInteger(row.заявка_id ?? row.order_id),
                    normalizeDateTime(row.дата_заказа ?? row.ordered_at),
                    normalizeDateTime(row.дата_поступления ?? row.received_at),
                    normalizeString(row.статус ?? row.status) ?? 'заказано',
                    normalizeNumber(row.общая_сумма ?? row.total_amount) ?? 0,
                    normalizeBoolean(row.использовать_доставку ?? row.use_delivery) ?? false,
                    normalizeInteger(row.транспорт_id ?? row.transport_id),
                    normalizeNumber(row.стоимость_доставки ?? row.delivery_cost),
                ];
                const positions = parseJsonCell<Array<Record<string, unknown>>>(row.positions_json ?? row.positions, []);

                let targetId: number;
                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Закупки" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        targetId = Number(existing.rows[0].id);
                        await queryable.query(
                            `
                            UPDATE public."Закупки"
                            SET
                                "поставщик_id" = $1,
                                "заявка_id" = $2,
                                "дата_заказа" = COALESCE($3, "дата_заказа"),
                                "дата_поступления" = $4,
                                "статус" = $5,
                                "общая_сумма" = $6,
                                "использовать_доставку" = $7,
                                "транспорт_id" = $8,
                                "стоимость_доставки" = $9
                            WHERE id = $10
                            `,
                            [...payload, targetId]
                        );
                        summary.updated += 1;
                    } else {
                        const inserted = await queryable.query(
                            `
                            INSERT INTO public."Закупки" (
                                id, "поставщик_id", "заявка_id", "дата_заказа", "дата_поступления", "статус",
                                "общая_сумма", "использовать_доставку", "транспорт_id", "стоимость_доставки"
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                            RETURNING id
                            `,
                            [id, ...payload]
                        );
                        targetId = Number(inserted.rows[0].id);
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    const inserted = await queryable.query(
                        `
                        INSERT INTO public."Закупки" (
                            "поставщик_id", "заявка_id", "дата_заказа", "дата_поступления", "статус",
                            "общая_сумма", "использовать_доставку", "транспорт_id", "стоимость_доставки"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING id
                        `,
                        payload
                    );
                    targetId = Number(inserted.rows[0].id);
                    summary.created += 1;
                }

                await replacePurchasePositions(queryable, targetId, positions);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Закупки"');
            }

            return summary;
        },
    },
    shipments: {
        key: 'shipments',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    s.*,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', sp.id,
                                    'product_id', sp.product_id,
                                    'quantity', sp.quantity,
                                    'price', sp.price,
                                    'vat_id', sp.vat_id
                                )
                                ORDER BY sp.id
                            )
                            FROM public.shipment_positions sp
                            WHERE sp.shipment_id = s.id
                        ),
                        '[]'::jsonb
                    ) AS positions_json
                FROM public."Отгрузки" s
                ORDER BY s.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                positions_json: JSON.stringify(row.positions_json ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const payload = [
                    normalizeInteger(row.заявка_id ?? row.order_id),
                    normalizeInteger(row.транспорт_id ?? row.transport_id),
                    normalizeString(row.статус ?? row.status) ?? 'в пути',
                    normalizeString(row.номер_отслеживания ?? row.tracking_number),
                    normalizeDateTime(row.дата_отгрузки ?? row.shipped_at),
                    normalizeNumber(row.стоимость_доставки ?? row.delivery_cost),
                    normalizeInteger(row.branch_no) ?? 1,
                    normalizeString(row.shipment_kind) ?? 'основная',
                    normalizeBoolean(row.использовать_доставку ?? row.use_delivery) ?? true,
                    normalizeBoolean(row.без_учета_склада ?? row.without_warehouse) ?? false,
                ];
                const positions = parseJsonCell<Array<Record<string, unknown>>>(row.positions_json ?? row.positions, []);

                let targetId: number;
                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Отгрузки" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        targetId = Number(existing.rows[0].id);
                        await queryable.query(
                            `
                            UPDATE public."Отгрузки"
                            SET
                                "заявка_id" = $1,
                                "транспорт_id" = $2,
                                "статус" = $3,
                                "номер_отслеживания" = $4,
                                "дата_отгрузки" = COALESCE($5, "дата_отгрузки"),
                                "стоимость_доставки" = $6,
                                branch_no = $7,
                                shipment_kind = $8,
                                "использовать_доставку" = $9,
                                "без_учета_склада" = $10
                            WHERE id = $11
                            `,
                            [...payload, targetId]
                        );
                        summary.updated += 1;
                    } else {
                        const inserted = await queryable.query(
                            `
                            INSERT INTO public."Отгрузки" (
                                id, "заявка_id", "транспорт_id", "статус", "номер_отслеживания", "дата_отгрузки",
                                "стоимость_доставки", branch_no, shipment_kind, "использовать_доставку", "без_учета_склада"
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            RETURNING id
                            `,
                            [id, ...payload]
                        );
                        targetId = Number(inserted.rows[0].id);
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    const inserted = await queryable.query(
                        `
                        INSERT INTO public."Отгрузки" (
                            "заявка_id", "транспорт_id", "статус", "номер_отслеживания", "дата_отгрузки",
                            "стоимость_доставки", branch_no, shipment_kind, "использовать_доставку", "без_учета_склада"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING id
                        `,
                        payload
                    );
                    targetId = Number(inserted.rows[0].id);
                    summary.created += 1;
                }

                await replaceShipmentPositions(queryable, targetId, positions);
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Отгрузки"');
            }

            return summary;
        },
    },
    warehouse: {
        key: 'warehouse',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    w.id,
                    w."товар_id",
                    t."артикул" AS product_article,
                    t."название" AS product_name,
                    w."количество",
                    w."дата_последнего_поступления",
                    w.updated_at
                FROM public."Склад" w
                LEFT JOIN public."Товары" t ON t.id = w."товар_id"
                ORDER BY w.id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const productId = await resolveProductId(queryable, row);
                if (productId == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка склада без распознанного товара.');
                    continue;
                }

                const id = normalizeInteger(row.id);
                const payload = [
                    productId,
                    normalizeInteger(row.количество ?? row.quantity) ?? 0,
                    normalizeDateTime(row.дата_последнего_поступления ?? row.last_received_at),
                    normalizeDateTime(row.updated_at),
                ];

                const existing = id != null
                    ? await queryable.query('SELECT id FROM public."Склад" WHERE id = $1 OR "товар_id" = $2 LIMIT 1', [id, productId])
                    : await queryable.query('SELECT id FROM public."Склад" WHERE "товар_id" = $1 LIMIT 1', [productId]);

                if (existing.rows.length > 0) {
                    await queryable.query(
                        `
                        UPDATE public."Склад"
                        SET
                            "товар_id" = $1,
                            "количество" = $2,
                            "дата_последнего_поступления" = $3,
                            updated_at = COALESCE($4::timestamp, CURRENT_TIMESTAMP)
                        WHERE id = $5
                        `,
                        [...payload, Number(existing.rows[0].id)]
                    );
                    summary.updated += 1;
                } else if (id != null) {
                    await queryable.query(
                        `
                        INSERT INTO public."Склад" (
                            id, "товар_id", "количество", "дата_последнего_поступления", updated_at
                        ) VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, CURRENT_TIMESTAMP))
                        `,
                        [id, ...payload]
                    );
                    summary.created += 1;
                    needSequenceSync = true;
                } else {
                    await queryable.query(
                        `
                        INSERT INTO public."Склад" (
                            "товар_id", "количество", "дата_последнего_поступления", updated_at
                        ) VALUES ($1, $2, $3, COALESCE($4::timestamp, CURRENT_TIMESTAMP))
                        `,
                        payload
                    );
                    summary.created += 1;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Склад"');
            }

            return summary;
        },
    },
    warehouse_movements: {
        key: 'warehouse_movements',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    m.id,
                    m."товар_id",
                    t."артикул" AS product_article,
                    t."название" AS product_name,
                    m."тип_операции",
                    m."количество",
                    m."дата_операции",
                    m."заявка_id",
                    m."закупка_id",
                    m."отгрузка_id",
                    m."комментарий"
                FROM public."Движения_склада" m
                LEFT JOIN public."Товары" t ON t.id = m."товар_id"
                ORDER BY m.id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const productId = await resolveProductId(queryable, row);
                const operationType = normalizeString(row.тип_операции ?? row.operation_type);
                const quantity = normalizeInteger(row.количество ?? row.quantity);
                if (productId == null || !operationType || quantity == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка движения склада без товара, типа операции или количества.');
                    continue;
                }

                const id = normalizeInteger(row.id);
                const payload = [
                    productId,
                    operationType,
                    quantity,
                    normalizeDateTime(row.дата_операции ?? row.operation_date),
                    normalizeInteger(row.заявка_id ?? row.order_id),
                    normalizeInteger(row.закупка_id ?? row.purchase_id),
                    normalizeString(row.комментарий ?? row.comment),
                    normalizeInteger(row.отгрузка_id ?? row.shipment_id),
                ];

                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Движения_склада" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        await queryable.query(
                            `
                            UPDATE public."Движения_склада"
                            SET
                                "товар_id" = $1,
                                "тип_операции" = $2,
                                "количество" = $3,
                                "дата_операции" = COALESCE($4::timestamp, CURRENT_TIMESTAMP),
                                "заявка_id" = $5,
                                "закупка_id" = $6,
                                "комментарий" = $7,
                                "отгрузка_id" = $8
                            WHERE id = $9
                            `,
                            [...payload, id]
                        );
                        summary.updated += 1;
                    } else {
                        await queryable.query(
                            `
                            INSERT INTO public."Движения_склада" (
                                id, "товар_id", "тип_операции", "количество", "дата_операции",
                                "заявка_id", "закупка_id", "комментарий", "отгрузка_id"
                            ) VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, CURRENT_TIMESTAMP), $6, $7, $8, $9)
                            `,
                            [id, ...payload]
                        );
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    await queryable.query(
                        `
                        INSERT INTO public."Движения_склада" (
                            "товар_id", "тип_операции", "количество", "дата_операции",
                            "заявка_id", "закупка_id", "комментарий", "отгрузка_id"
                        ) VALUES ($1, $2, $3, COALESCE($4::timestamp, CURRENT_TIMESTAMP), $5, $6, $7, $8)
                        `,
                        payload
                    );
                    summary.created += 1;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Движения_склада"');
            }

            return summary;
        },
    },
    finance: {
        key: 'finance',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    id, "дата", "тип", "описание", "сумма", "баланс_после",
                    "заявка_id", "закупка_id", "отгрузка_id", "выплата_id", "товар_id",
                    "счет_учета", "счет_затрат", "тип_номенклатуры", "источник"
                FROM public."Финансы_компании"
                ORDER BY id DESC
                `
            );
            return result.rows;
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const id = normalizeInteger(row.id);
                const amount = normalizeNumber(row.сумма ?? row.amount);
                if (amount == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка финансов без суммы.');
                    continue;
                }

                const payload = [
                    normalizeDateTime(row.дата ?? row.created_at),
                    normalizeString(row.тип ?? row.type),
                    normalizeString(row.описание ?? row.description),
                    amount,
                    normalizeNumber(row.баланс_после ?? row.balance_after),
                    normalizeInteger(row.заявка_id ?? row.order_id),
                    normalizeInteger(row.закупка_id ?? row.purchase_id),
                    normalizeInteger(row.отгрузка_id ?? row.shipment_id),
                    normalizeInteger(row.выплата_id ?? row.payment_id),
                    await resolveProductId(queryable, row),
                    normalizeString(row.счет_учета ?? row.account_code),
                    normalizeString(row.счет_затрат ?? row.expense_account),
                    normalizeString(row.тип_номенклатуры ?? row.nomenclature_type),
                    normalizeString(row.источник ?? row.source),
                ];

                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Финансы_компании" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        await queryable.query(
                            `
                            UPDATE public."Финансы_компании"
                            SET
                                "дата" = COALESCE($1::timestamp, CURRENT_TIMESTAMP),
                                "тип" = $2,
                                "описание" = $3,
                                "сумма" = $4,
                                "баланс_после" = $5,
                                "заявка_id" = $6,
                                "закупка_id" = $7,
                                "отгрузка_id" = $8,
                                "выплата_id" = $9,
                                "товар_id" = $10,
                                "счет_учета" = $11,
                                "счет_затрат" = $12,
                                "тип_номенклатуры" = $13,
                                "источник" = $14
                            WHERE id = $15
                            `,
                            [...payload, id]
                        );
                        summary.updated += 1;
                    } else {
                        await queryable.query(
                            `
                            INSERT INTO public."Финансы_компании" (
                                id, "дата", "тип", "описание", "сумма", "баланс_после",
                                "заявка_id", "закупка_id", "отгрузка_id", "выплата_id", "товар_id",
                                "счет_учета", "счет_затрат", "тип_номенклатуры", "источник"
                            ) VALUES (
                                $1, COALESCE($2::timestamp, CURRENT_TIMESTAMP), $3, $4, $5, $6,
                                $7, $8, $9, $10, $11, $12, $13, $14, $15
                            )
                            `,
                            [id, ...payload]
                        );
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    await queryable.query(
                        `
                        INSERT INTO public."Финансы_компании" (
                            "дата", "тип", "описание", "сумма", "баланс_после",
                            "заявка_id", "закупка_id", "отгрузка_id", "выплата_id", "товар_id",
                            "счет_учета", "счет_затрат", "тип_номенклатуры", "источник"
                        ) VALUES (
                            COALESCE($1::timestamp, CURRENT_TIMESTAMP), $2, $3, $4, $5,
                            $6, $7, $8, $9, $10, $11, $12, $13, $14
                        )
                        `,
                        payload
                    );
                    summary.created += 1;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Финансы_компании"');
            }

            return summary;
        },
    },
    payments: {
        key: 'payments',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    id, "сотрудник_id", "сумма", "дата", "тип", "заявка_id", "статус", "комментарий",
                    "начислено", "удержано", "выплачено", "к_выплате", "вид_выплаты",
                    "период_с", "период_по", "расчет"
                FROM public."Выплаты"
                ORDER BY id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                расчет: JSON.stringify(row.расчет ?? null),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();
            let needSequenceSync = false;

            for (const row of rows) {
                const employeeId = normalizeInteger(row.сотрудник_id ?? row.employee_id);
                const amount = normalizeNumber(row.сумма ?? row.amount);
                if (employeeId == null || amount == null) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка выплаты без сотрудника или суммы.');
                    continue;
                }

                const id = normalizeInteger(row.id);
                const payload = [
                    employeeId,
                    amount,
                    normalizeDateTime(row.дата ?? row.created_at),
                    normalizeString(row.тип ?? row.type),
                    normalizeInteger(row.заявка_id ?? row.order_id),
                    normalizeString(row.статус ?? row.status),
                    normalizeString(row.комментарий ?? row.comment),
                    normalizeNumber(row.начислено ?? row.accrued),
                    normalizeNumber(row.удержано ?? row.withheld),
                    normalizeNumber(row.выплачено ?? row.paid),
                    normalizeNumber(row.к_выплате ?? row.to_pay),
                    normalizeString(row.вид_выплаты ?? row.payment_kind),
                    normalizeDate(row.период_с ?? row.period_from),
                    normalizeDate(row.период_по ?? row.period_to),
                    JSON.stringify(parseJsonCell(row.расчет ?? row.calculation, null)),
                ];

                if (id != null) {
                    const existing = await queryable.query('SELECT id FROM public."Выплаты" WHERE id = $1 LIMIT 1', [id]);
                    if (existing.rows.length > 0) {
                        await queryable.query(
                            `
                            UPDATE public."Выплаты"
                            SET
                                "сотрудник_id" = $1,
                                "сумма" = $2,
                                "дата" = COALESCE($3::timestamp, CURRENT_TIMESTAMP),
                                "тип" = $4,
                                "заявка_id" = $5,
                                "статус" = $6,
                                "комментарий" = $7,
                                "начислено" = $8,
                                "удержано" = $9,
                                "выплачено" = $10,
                                "к_выплате" = $11,
                                "вид_выплаты" = $12,
                                "период_с" = $13,
                                "период_по" = $14,
                                "расчет" = $15::jsonb
                            WHERE id = $16
                            `,
                            [...payload, id]
                        );
                        summary.updated += 1;
                    } else {
                        await queryable.query(
                            `
                            INSERT INTO public."Выплаты" (
                                id, "сотрудник_id", "сумма", "дата", "тип", "заявка_id", "статус", "комментарий",
                                "начислено", "удержано", "выплачено", "к_выплате", "вид_выплаты",
                                "период_с", "период_по", "расчет"
                            ) VALUES (
                                $1, $2, $3, COALESCE($4::timestamp, CURRENT_TIMESTAMP), $5, $6, $7, $8,
                                $9, $10, $11, $12, $13, $14, $15, $16::jsonb
                            )
                            `,
                            [id, ...payload]
                        );
                        summary.created += 1;
                        needSequenceSync = true;
                    }
                } else {
                    await queryable.query(
                        `
                        INSERT INTO public."Выплаты" (
                            "сотрудник_id", "сумма", "дата", "тип", "заявка_id", "статус", "комментарий",
                            "начислено", "удержано", "выплачено", "к_выплате", "вид_выплаты",
                            "период_с", "период_по", "расчет"
                        ) VALUES (
                            $1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13, $14, $15::jsonb
                        )
                        `,
                        payload
                    );
                    summary.created += 1;
                }
            }

            if (needSequenceSync) {
                await ensureSequence(queryable, 'public."Выплаты"');
            }

            return summary;
        },
    },
    settings: {
        key: 'settings',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT key, value, updated_at
                FROM public.app_settings
                ORDER BY key
                `
            );
            return result.rows.map((row) => ({
                ...row,
                value: JSON.stringify(row.value ?? {}),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();

            for (const row of rows) {
                const key = normalizeString(row.key);
                if (!key) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка настройки без ключа.');
                    continue;
                }

                await queryable.query(
                    `
                    INSERT INTO public.app_settings (key, value, updated_at)
                    VALUES ($1, $2::jsonb, COALESCE($3::timestamp, CURRENT_TIMESTAMP))
                    ON CONFLICT (key) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = EXCLUDED.updated_at
                    `,
                    [
                        key,
                        JSON.stringify(parseJsonCell(row.value, {})),
                        normalizeDateTime(row.updated_at),
                    ]
                );
                summary.updated += 1;
            }

            return summary;
        },
    },
    documents: {
        key: 'documents',
        exportRows: async (queryable) => {
            const result = await queryable.query(
                `
                SELECT
                    a.id,
                    a.filename,
                    a.mime_type,
                    a.size_bytes,
                    a.sha256,
                    encode(a.content, 'base64') AS content_base64,
                    a.created_at,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', l.id,
                                    'entity_type', l.entity_type,
                                    'entity_id', l.entity_id,
                                    'created_at', l.created_at
                                )
                                ORDER BY l.created_at ASC, l.id ASC
                            )
                            FROM public.attachment_links l
                            WHERE l.attachment_id = a.id
                        ),
                        '[]'::jsonb
                    ) AS links_json
                FROM public.attachments a
                ORDER BY a.created_at DESC, a.id DESC
                `
            );
            return result.rows.map((row) => ({
                ...row,
                links_json: JSON.stringify(row.links_json ?? []),
            }));
        },
        importRows: async (queryable, rows) => {
            const summary = emptySummary();

            for (const row of rows) {
                const id = normalizeString(row.id);
                const filename = normalizeString(row.filename);
                const mimeType = normalizeString(row.mime_type);
                const contentBase64 = normalizeString(row.content_base64);

                if (!id || !filename || !mimeType || !contentBase64) {
                    summary.skipped += 1;
                    summary.warnings.push('Пропущена строка документа без id, имени, mime-type или содержимого.');
                    continue;
                }

                await queryable.query(
                    `
                    INSERT INTO public.attachments (
                        id, filename, mime_type, size_bytes, sha256, content, created_at
                    ) VALUES (
                        $1::uuid, $2, $3, $4, $5, decode($6, 'base64'), COALESCE($7::timestamp, CURRENT_TIMESTAMP)
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        filename = EXCLUDED.filename,
                        mime_type = EXCLUDED.mime_type,
                        size_bytes = EXCLUDED.size_bytes,
                        sha256 = EXCLUDED.sha256,
                        content = EXCLUDED.content,
                        created_at = EXCLUDED.created_at
                    `,
                    [
                        id,
                        filename,
                        mimeType,
                        normalizeInteger(row.size_bytes) ?? Buffer.from(contentBase64, 'base64').length,
                        normalizeString(row.sha256),
                        contentBase64,
                        normalizeDateTime(row.created_at),
                    ]
                );

                await queryable.query('DELETE FROM public.attachment_links WHERE attachment_id = $1::uuid', [id]);
                const links = parseJsonCell<Array<Record<string, unknown>>>(row.links_json ?? row.links, []);

                for (const link of links) {
                    const entityType = normalizeString(link.entity_type);
                    const entityId = normalizeInteger(link.entity_id);
                    if (!entityType || entityId == null) continue;

                    const explicitLinkId = normalizeString(link.id);
                    if (explicitLinkId) {
                        await queryable.query(
                            `
                            INSERT INTO public.attachment_links (
                                id, entity_type, entity_id, attachment_id, created_at
                            ) VALUES (
                                $1::uuid, $2, $3, $4::uuid, COALESCE($5::timestamp, CURRENT_TIMESTAMP)
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                entity_type = EXCLUDED.entity_type,
                                entity_id = EXCLUDED.entity_id,
                                attachment_id = EXCLUDED.attachment_id,
                                created_at = EXCLUDED.created_at
                            `,
                            [explicitLinkId, entityType, entityId, id, normalizeDateTime(link.created_at)]
                        );
                    } else {
                        await queryable.query(
                            `
                            INSERT INTO public.attachment_links (
                                entity_type, entity_id, attachment_id, created_at
                            ) VALUES (
                                $1, $2, $3::uuid, COALESCE($4::timestamp, CURRENT_TIMESTAMP)
                            )
                            ON CONFLICT (entity_type, entity_id, attachment_id) DO NOTHING
                            `,
                            [entityType, entityId, id, normalizeDateTime(link.created_at)]
                        );
                    }
                }

                summary.updated += 1;
            }

            return summary;
        },
    },
};

export const getDataExchangeRegistryEntry = (catalogKey: DataExchangeCatalogKey) => {
    return registry[catalogKey];
};

export const exportCatalogs = async (catalogKeys: DataExchangeCatalogKey[]) => {
    const rowsByCatalog: Partial<Record<DataExchangeCatalogKey, Record<string, unknown>[]>> = {};
    for (const catalogKey of catalogKeys) {
        const entry = getDataExchangeRegistryEntry(catalogKey);
        rowsByCatalog[catalogKey] = await entry.exportRows({ query });
    }
    return rowsByCatalog;
};

export const buildExportFile = async (
    catalogKeys: DataExchangeCatalogKey[],
    format: DataExchangeFormat
) => {
    const rowsByCatalog = await exportCatalogs(catalogKeys);
    if (format === 'csv') {
        if (catalogKeys.length !== 1) {
            throw new Error('CSV экспорт доступен только для одного раздела за раз.');
        }
        const onlyKey = catalogKeys[0];
        return {
            buffer: toCsvBuffer(rowsByCatalog[onlyKey] ?? []),
            contentType: getExportContentType(format),
            extension: getFileExtension(format),
        };
    }

    if (format === 'json') {
        const payload = catalogKeys.length === 1 ? (rowsByCatalog[catalogKeys[0]] ?? []) : rowsByCatalog;
        return {
            buffer: toJsonBuffer(payload),
            contentType: getExportContentType(format),
            extension: getFileExtension(format),
        };
    }

    return {
        buffer: toWorkbookBuffer(rowsByCatalog),
        contentType: getExportContentType(format),
        extension: getFileExtension(format),
    };
};

export const parseImportBuffer = (
    fileBuffer: Buffer,
    format: DataExchangeFormat,
    catalogKeys: DataExchangeCatalogKey[]
): ParsedImportPayload => {
    if (format === 'json') {
        const text = fileBuffer.toString('utf-8');
        const parsed = JSON.parse(text);
        if (catalogKeys.length === 1 && Array.isArray(parsed)) {
            return { rowsByCatalog: { [catalogKeys[0]]: normalizeRows(parsed) } };
        }
        const rowsByCatalog: ParsedImportPayload['rowsByCatalog'] = {};
        for (const catalogKey of catalogKeys) {
            rowsByCatalog[catalogKey] = normalizeRows((parsed as any)?.[catalogKey]);
        }
        return { rowsByCatalog };
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    if (format === 'csv') {
        if (catalogKeys.length !== 1) {
            throw new Error('CSV импорт доступен только для одного раздела.');
        }
        const firstSheet = workbook.SheetNames[0];
        return {
            rowsByCatalog: {
                [catalogKeys[0]]: mapExcelLikeRows(workbook.Sheets[firstSheet]),
            },
        };
    }

    const rowsByCatalog: ParsedImportPayload['rowsByCatalog'] = {};
    for (const catalogKey of catalogKeys) {
        const matchedSheet = getCatalogSheetByName(workbook, catalogKey);
        const fallbackSheet = catalogKeys.length === 1 ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
        rowsByCatalog[catalogKey] = mapExcelLikeRows(matchedSheet || fallbackSheet);
    }
    return { rowsByCatalog };
};

export const importCatalogRows = async (
    rowsByCatalog: Partial<Record<DataExchangeCatalogKey, Record<string, unknown>[]>>,
    catalogKeys: DataExchangeCatalogKey[]
) => {
    return withTransaction(async (client) => {
        const summaries: Partial<Record<DataExchangeCatalogKey, DataExchangeSummary>> = {};
        for (const catalogKey of catalogKeys) {
        const entry = getDataExchangeRegistryEntry(catalogKey);
        const rows = normalizeRows(rowsByCatalog[catalogKey]);
        if (rows.length === 0) {
            summaries[catalogKey] = {
                created: 0,
                updated: 0,
                skipped: 0,
                warnings: ['Файл не содержит строк для выбранного раздела.'],
            };
            continue;
        }
            summaries[catalogKey] = await entry.importRows(client, rows);
        }
        return summaries;
    });
};

export const normalizeCatalogKeys = (raw: string | string[] | undefined): DataExchangeCatalogKey[] => {
    const text = Array.isArray(raw) ? raw.join(',') : raw ?? '';
    const requested = text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean) as DataExchangeCatalogKey[];
    const known = new Set(DATA_EXCHANGE_CATALOGS.map((item) => item.key));
    return requested.filter((item) => known.has(item));
};
