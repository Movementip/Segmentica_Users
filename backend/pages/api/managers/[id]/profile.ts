import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../../../lib/db';
import { hasPermission, requireAuth } from '../../../../lib/auth';
import {
    composeFio,
    createEmptyManagerHrProfile,
    ManagerEmploymentEvent,
    ManagerHrProfile,
    ManagerIdentityDocument,
    ManagerMilitaryDocument,
    ManagerRelative,
    normalizeStringArray,
} from '../../../../lib/managerHr';

type ManagerHrResponse =
    | {
        available: boolean;
        data: ManagerHrProfile;
    }
    | { error: string };

const HR_TABLE_NAMES = [
    'employee_profiles',
    'employee_identity_documents',
    'employee_bank_details',
    'employee_employment_details',
    'employee_employment_events',
    'employee_relatives',
    'employee_military_records',
    'employee_military_documents',
];

const parseEmployeeId = (req: NextApiRequest): number | null => {
    const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
};

const hasHrSchema = async (): Promise<boolean> => {
    const res = await query(
        `SELECT COUNT(*)::int AS count
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
        [HR_TABLE_NAMES]
    );
    return Number(res.rows?.[0]?.count || 0) === HR_TABLE_NAMES.length;
};

const getBaseEmployee = async (employeeId: number) => {
    const result = await query(
        `
    SELECT
      id,
      "фио" AS fio,
      "должность" AS position,
      "ставка" AS rate,
      "дата_приема" AS hire_date,
      "активен" AS is_active,
      created_at,
      "телефон" AS phone,
      email
    FROM public."Сотрудники"
    WHERE id = $1
    LIMIT 1
    `,
        [employeeId]
    );

    return result.rows?.[0] || null;
};

const normalizeDate = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const normalizeText = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const normalizeBoolean = (value: unknown): boolean => Boolean(value);

const normalizeIdentityDocument = (value: any, index: number): ManagerIdentityDocument => ({
    id: Number(value?.id) || index + 1,
    documentType: normalizeText(value?.documentType),
    seriesNumber: normalizeText(value?.seriesNumber),
    issuedBy: normalizeText(value?.issuedBy),
    departmentCode: normalizeText(value?.departmentCode),
    issueDate: normalizeDate(value?.issueDate),
    validUntil: normalizeDate(value?.validUntil),
    isPrimary: normalizeBoolean(value?.isPrimary),
});

const normalizeEmploymentEvent = (value: any, index: number): ManagerEmploymentEvent => ({
    id: Number(value?.id) || index + 1,
    eventDate: normalizeDate(value?.eventDate),
    eventType: normalizeText(value?.eventType),
    details: normalizeText(value?.details),
    status: normalizeText(value?.status),
    sentDate: normalizeDate(value?.sentDate),
    externalUuid: normalizeText(value?.externalUuid) || null,
});

const normalizeRelative = (value: any, index: number): ManagerRelative => ({
    id: Number(value?.id) || index + 1,
    fullName: normalizeText(value?.fullName),
    relationType: normalizeText(value?.relationType),
    birthDate: normalizeDate(value?.birthDate),
    documentInfo: normalizeText(value?.documentInfo),
    snils: normalizeText(value?.snils),
    phone: normalizeText(value?.phone),
    notes: normalizeText(value?.notes),
});

const normalizeMilitaryDocument = (value: any, index: number): ManagerMilitaryDocument => ({
    id: Number(value?.id) || index + 1,
    documentType: normalizeText(value?.documentType),
    seriesNumber: normalizeText(value?.seriesNumber),
    issuedBy: normalizeText(value?.issuedBy),
    issueDate: normalizeDate(value?.issueDate),
    validUntil: normalizeDate(value?.validUntil),
});

const sanitizePayload = (employeeId: number, body: any, baseRow: any): ManagerHrProfile => {
    const fallback = createEmptyManagerHrProfile({
        employeeId,
        fio: baseRow?.fio,
        position: baseRow?.position,
        rate: baseRow?.rate == null ? null : Number(baseRow.rate),
        hireDate: baseRow?.hire_date == null ? null : String(baseRow.hire_date),
        isActive: Boolean(baseRow?.is_active),
        createdAt: baseRow?.created_at == null ? null : String(baseRow.created_at),
        email: baseRow?.email == null ? null : String(baseRow.email),
        phone: baseRow?.phone == null ? null : String(baseRow.phone),
    });

    const personal = body?.personal || {};
    const bank = body?.bank || {};
    const employment = body?.employment || {};
    const military = body?.military || {};

    const fullName = composeFio(personal.lastName, personal.firstName, personal.middleName) || fallback.manager.fio;

    return {
        employeeId,
        manager: {
            id: employeeId,
            fio: fullName,
            position: String(baseRow?.position || fallback.manager.position || ''),
            rate: baseRow?.rate == null ? fallback.manager.rate : Number(baseRow.rate),
            hireDate: baseRow?.hire_date == null ? fallback.manager.hireDate : String(baseRow.hire_date),
            isActive: Boolean(baseRow?.is_active),
            createdAt: baseRow?.created_at == null ? fallback.manager.createdAt : String(baseRow.created_at),
        },
        personal: {
            lastName: normalizeText(personal.lastName),
            firstName: normalizeText(personal.firstName),
            middleName: normalizeText(personal.middleName),
            gender: normalizeText(personal.gender),
            birthDate: normalizeDate(personal.birthDate),
            birthPlace: normalizeText(personal.birthPlace),
            maritalStatus: normalizeText(personal.maritalStatus),
            maritalStatusSince: normalizeDate(personal.maritalStatusSince),
            snils: normalizeText(personal.snils),
            inn: normalizeText(personal.inn),
            taxpayerStatus: normalizeText(personal.taxpayerStatus),
            citizenshipCode: normalizeText(personal.citizenshipCode),
            citizenshipLabel: normalizeText(personal.citizenshipLabel),
            registrationAddress: normalizeText(personal.registrationAddress),
            registrationDate: normalizeDate(personal.registrationDate),
            actualAddressSameAsRegistration: normalizeBoolean(personal.actualAddressSameAsRegistration),
            actualAddress: normalizeText(personal.actualAddress),
            actualAddressSince: normalizeDate(personal.actualAddressSince),
            personalEmail: normalizeText(personal.personalEmail),
            workEmail: normalizeText(personal.workEmail),
            primaryPhone: normalizeText(personal.primaryPhone),
            workPhone: normalizeText(personal.workPhone),
            educationLevel: normalizeText(personal.educationLevel),
            primaryProfession: normalizeText(personal.primaryProfession),
            secondaryProfession: normalizeText(personal.secondaryProfession),
            languages: normalizeStringArray(personal.languages),
            notes: normalizeText(personal.notes),
        },
        bank: {
            bankName: normalizeText(bank.bankName),
            bankBik: normalizeText(bank.bankBik),
            settlementAccount: normalizeText(bank.settlementAccount),
            correspondentAccount: normalizeText(bank.correspondentAccount),
            mirCardNumber: normalizeText(bank.mirCardNumber),
            alternativeBankName: normalizeText(bank.alternativeBankName),
            alternativeAccountNumber: normalizeText(bank.alternativeAccountNumber),
            notes: normalizeText(bank.notes),
        },
        employment: {
            positionCategory: normalizeText(employment.positionCategory),
            departmentName: normalizeText(employment.departmentName),
            subdivisionName: normalizeText(employment.subdivisionName),
            isFlightCrew: normalizeBoolean(employment.isFlightCrew),
            isSeaCrew: normalizeBoolean(employment.isSeaCrew),
            contractType: normalizeText(employment.contractType),
            laborBookStatus: normalizeText(employment.laborBookStatus),
            laborBookNotes: normalizeText(employment.laborBookNotes),
            foreignWorkPermitNote: normalizeText(employment.foreignWorkPermitNote),
        },
        military: {
            relationToService: normalizeText(military.relationToService),
            reserveCategory: normalizeText(military.reserveCategory),
            militaryRank: normalizeText(military.militaryRank),
            unitComposition: normalizeText(military.unitComposition),
            specialtyCode: normalizeText(military.specialtyCode),
            fitnessCategory: normalizeText(military.fitnessCategory),
            fitnessCheckedAt: normalizeDate(military.fitnessCheckedAt),
            commissariatName: normalizeText(military.commissariatName),
            commissariatManual: normalizeText(military.commissariatManual),
            additionalInfo: normalizeText(military.additionalInfo),
            militaryRegistrationType: normalizeText(military.militaryRegistrationType),
        },
        identityDocuments: Array.isArray(body?.identityDocuments)
            ? body.identityDocuments.map(normalizeIdentityDocument).filter((item) => item.documentType || item.seriesNumber || item.issuedBy)
            : [],
        employmentEvents: Array.isArray(body?.employmentEvents)
            ? body.employmentEvents.map(normalizeEmploymentEvent).filter((item) => item.eventType || item.details || item.eventDate)
            : [],
        relatives: Array.isArray(body?.relatives)
            ? body.relatives.map(normalizeRelative).filter((item) => item.fullName || item.relationType || item.phone)
            : [],
        militaryDocuments: Array.isArray(body?.militaryDocuments)
            ? body.militaryDocuments.map(normalizeMilitaryDocument).filter((item) => item.documentType || item.seriesNumber || item.issuedBy)
            : [],
    };
};

const readProfile = async (employeeId: number, baseRow: any): Promise<ManagerHrProfile> => {
    const fallback = createEmptyManagerHrProfile({
        employeeId,
        fio: baseRow?.fio,
        position: baseRow?.position,
        rate: baseRow?.rate == null ? null : Number(baseRow.rate),
        hireDate: baseRow?.hire_date == null ? null : String(baseRow.hire_date),
        isActive: Boolean(baseRow?.is_active),
        createdAt: baseRow?.created_at == null ? null : String(baseRow.created_at),
        email: baseRow?.email == null ? null : String(baseRow.email),
        phone: baseRow?.phone == null ? null : String(baseRow.phone),
    });

    const [
        profileRes,
        bankRes,
        employmentRes,
        militaryRes,
        identityDocsRes,
        eventsRes,
        relativesRes,
        militaryDocsRes,
    ] = await Promise.all([
        query(`SELECT * FROM public.employee_profiles WHERE employee_id = $1 LIMIT 1`, [employeeId]),
        query(`SELECT * FROM public.employee_bank_details WHERE employee_id = $1 LIMIT 1`, [employeeId]),
        query(`SELECT * FROM public.employee_employment_details WHERE employee_id = $1 LIMIT 1`, [employeeId]),
        query(`SELECT * FROM public.employee_military_records WHERE employee_id = $1 LIMIT 1`, [employeeId]),
        query(
            `SELECT id, document_type, series_number, issued_by, department_code, issue_date, valid_until, is_primary
       FROM public.employee_identity_documents
       WHERE employee_id = $1
       ORDER BY is_primary DESC, issue_date DESC NULLS LAST, id DESC`,
            [employeeId]
        ),
        query(
            `SELECT id, event_date, event_type, details, status, sent_date, external_uuid
       FROM public.employee_employment_events
       WHERE employee_id = $1
       ORDER BY event_date DESC NULLS LAST, id DESC`,
            [employeeId]
        ),
        query(
            `SELECT id, full_name, relation_type, birth_date, document_info, snils, phone, notes
       FROM public.employee_relatives
       WHERE employee_id = $1
       ORDER BY id DESC`,
            [employeeId]
        ),
        query(
            `SELECT id, document_type, series_number, issued_by, issue_date, valid_until
       FROM public.employee_military_documents
       WHERE employee_id = $1
       ORDER BY issue_date DESC NULLS LAST, id DESC`,
            [employeeId]
        ),
    ]);

    const profile = profileRes.rows?.[0];
    const bank = bankRes.rows?.[0];
    const employment = employmentRes.rows?.[0];
    const military = militaryRes.rows?.[0];

    return {
        ...fallback,
        manager: {
            ...fallback.manager,
            fio: composeFio(profile?.last_name, profile?.first_name, profile?.middle_name) || fallback.manager.fio,
        },
        personal: {
            ...fallback.personal,
            lastName: profile?.last_name || fallback.personal.lastName,
            firstName: profile?.first_name || fallback.personal.firstName,
            middleName: profile?.middle_name || fallback.personal.middleName,
            gender: profile?.gender || '',
            birthDate: profile?.birth_date ? String(profile.birth_date) : null,
            birthPlace: profile?.birth_place || '',
            maritalStatus: profile?.marital_status || '',
            maritalStatusSince: profile?.marital_status_since ? String(profile.marital_status_since) : null,
            snils: profile?.snils || '',
            inn: profile?.inn || '',
            taxpayerStatus: profile?.taxpayer_status || '',
            citizenshipCode: profile?.citizenship_code || fallback.personal.citizenshipCode,
            citizenshipLabel: profile?.citizenship_label || fallback.personal.citizenshipLabel,
            registrationAddress: profile?.registration_address || '',
            registrationDate: profile?.registration_date ? String(profile.registration_date) : null,
            actualAddressSameAsRegistration: profile?.actual_address_same_as_registration ?? true,
            actualAddress: profile?.actual_address || '',
            actualAddressSince: profile?.actual_address_since ? String(profile.actual_address_since) : null,
            personalEmail: profile?.personal_email || fallback.personal.personalEmail,
            workEmail: profile?.work_email || '',
            primaryPhone: profile?.primary_phone || fallback.personal.primaryPhone,
            workPhone: profile?.work_phone || '',
            educationLevel: profile?.education_level || '',
            primaryProfession: profile?.primary_profession || '',
            secondaryProfession: profile?.secondary_profession || '',
            languages: Array.isArray(profile?.languages) ? profile.languages.map(String) : [],
            notes: profile?.notes || '',
        },
        bank: {
            ...fallback.bank,
            bankName: bank?.bank_name || '',
            bankBik: bank?.bank_bik || '',
            settlementAccount: bank?.settlement_account || '',
            correspondentAccount: bank?.correspondent_account || '',
            mirCardNumber: bank?.mir_card_number || '',
            alternativeBankName: bank?.alternative_bank_name || '',
            alternativeAccountNumber: bank?.alternative_account_number || '',
            notes: bank?.notes || '',
        },
        employment: {
            ...fallback.employment,
            positionCategory: employment?.position_category || '',
            departmentName: employment?.department_name || '',
            subdivisionName: employment?.subdivision_name || '',
            isFlightCrew: Boolean(employment?.is_flight_crew),
            isSeaCrew: Boolean(employment?.is_sea_crew),
            contractType: employment?.contract_type || fallback.employment.contractType,
            laborBookStatus: employment?.labor_book_status || '',
            laborBookNotes: employment?.labor_book_notes || '',
            foreignWorkPermitNote: employment?.foreign_work_permit_note || '',
        },
        military: {
            ...fallback.military,
            relationToService: military?.relation_to_service || '',
            reserveCategory: military?.reserve_category || '',
            militaryRank: military?.military_rank || '',
            unitComposition: military?.unit_composition || '',
            specialtyCode: military?.specialty_code || '',
            fitnessCategory: military?.fitness_category || '',
            fitnessCheckedAt: military?.fitness_checked_at ? String(military.fitness_checked_at) : null,
            commissariatName: military?.commissariat_name || '',
            commissariatManual: military?.commissariat_manual || '',
            additionalInfo: military?.additional_info || '',
            militaryRegistrationType: military?.military_registration_type || '',
        },
        identityDocuments: (identityDocsRes.rows || []).map((row: any) => ({
            id: Number(row.id),
            documentType: String(row.document_type || ''),
            seriesNumber: String(row.series_number || ''),
            issuedBy: String(row.issued_by || ''),
            departmentCode: String(row.department_code || ''),
            issueDate: row.issue_date ? String(row.issue_date) : null,
            validUntil: row.valid_until ? String(row.valid_until) : null,
            isPrimary: Boolean(row.is_primary),
        })),
        employmentEvents: (eventsRes.rows || []).map((row: any) => ({
            id: Number(row.id),
            eventDate: row.event_date ? String(row.event_date) : null,
            eventType: String(row.event_type || ''),
            details: String(row.details || ''),
            status: String(row.status || ''),
            sentDate: row.sent_date ? String(row.sent_date) : null,
            externalUuid: row.external_uuid ? String(row.external_uuid) : null,
        })),
        relatives: (relativesRes.rows || []).map((row: any) => ({
            id: Number(row.id),
            fullName: String(row.full_name || ''),
            relationType: String(row.relation_type || ''),
            birthDate: row.birth_date ? String(row.birth_date) : null,
            documentInfo: String(row.document_info || ''),
            snils: String(row.snils || ''),
            phone: String(row.phone || ''),
            notes: String(row.notes || ''),
        })),
        militaryDocuments: (militaryDocsRes.rows || []).map((row: any) => ({
            id: Number(row.id),
            documentType: String(row.document_type || ''),
            seriesNumber: String(row.series_number || ''),
            issuedBy: String(row.issued_by || ''),
            issueDate: row.issue_date ? String(row.issue_date) : null,
            validUntil: row.valid_until ? String(row.valid_until) : null,
        })),
    };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ManagerHrResponse>) {
    try {
        const actor = await requireAuth(req, res);
        if (!actor) return;

        const employeeId = parseEmployeeId(req);
        if (!employeeId) {
            return res.status(400).json({ error: 'Некорректный ID сотрудника' });
        }

        const canRead = hasPermission(actor, 'managers.view') || actor.employee.id === employeeId;
        const canWrite = hasPermission(actor, 'managers.edit') || actor.employee.id === employeeId;

        if (req.method === 'GET') {
            if (!canRead) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const baseRow = await getBaseEmployee(employeeId);
            if (!baseRow) {
                return res.status(404).json({ error: 'Сотрудник не найден' });
            }

            const schemaAvailable = await hasHrSchema();
            if (!schemaAvailable) {
                return res.status(200).json({
                    available: false,
                    data: createEmptyManagerHrProfile({
                        employeeId,
                        fio: baseRow.fio,
                        position: baseRow.position,
                        rate: baseRow.rate == null ? null : Number(baseRow.rate),
                        hireDate: baseRow.hire_date == null ? null : String(baseRow.hire_date),
                        isActive: Boolean(baseRow.is_active),
                        createdAt: baseRow.created_at == null ? null : String(baseRow.created_at),
                        email: baseRow.email == null ? null : String(baseRow.email),
                        phone: baseRow.phone == null ? null : String(baseRow.phone),
                    }),
                });
            }

            const data = await readProfile(employeeId, baseRow);
            return res.status(200).json({ available: true, data });
        }

        if (req.method === 'PUT') {
            if (!canWrite) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            const schemaAvailable = await hasHrSchema();
            if (!schemaAvailable) {
                return res.status(400).json({ error: 'HR-таблицы еще не созданы. Сначала выполните SQL-миграцию.' });
            }

            const baseRow = await getBaseEmployee(employeeId);
            if (!baseRow) {
                return res.status(404).json({ error: 'Сотрудник не найден' });
            }

            const payload = sanitizePayload(employeeId, req.body, baseRow);
            if (!payload.personal.lastName || !payload.personal.firstName) {
                return res.status(400).json({ error: 'Укажите как минимум фамилию и имя сотрудника.' });
            }

            const fullName = composeFio(payload.personal.lastName, payload.personal.firstName, payload.personal.middleName);
            const basePhone = payload.personal.workPhone || payload.personal.primaryPhone || null;
            const baseEmail = payload.personal.workEmail || payload.personal.personalEmail || null;

            const pool = await getPool();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                await client.query(
                    `
          UPDATE public."Сотрудники"
          SET "фио" = $1,
              "телефон" = $2,
              email = $3
          WHERE id = $4
          `,
                    [fullName, basePhone, baseEmail, employeeId]
                );

                await client.query(
                    `
          INSERT INTO public.employee_profiles (
            employee_id,
            last_name,
            first_name,
            middle_name,
            gender,
            birth_date,
            birth_place,
            marital_status,
            marital_status_since,
            snils,
            inn,
            taxpayer_status,
            citizenship_code,
            citizenship_label,
            registration_address,
            registration_date,
            actual_address_same_as_registration,
            actual_address,
            actual_address_since,
            personal_email,
            work_email,
            primary_phone,
            work_phone,
            education_level,
            primary_profession,
            secondary_profession,
            languages,
            notes,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27::text[], $28, CURRENT_TIMESTAMP
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
                        payload.personal.lastName || null,
                        payload.personal.firstName || null,
                        payload.personal.middleName || null,
                        payload.personal.gender || null,
                        payload.personal.birthDate,
                        payload.personal.birthPlace || null,
                        payload.personal.maritalStatus || null,
                        payload.personal.maritalStatusSince,
                        payload.personal.snils || null,
                        payload.personal.inn || null,
                        payload.personal.taxpayerStatus || null,
                        payload.personal.citizenshipCode || null,
                        payload.personal.citizenshipLabel || null,
                        payload.personal.registrationAddress || null,
                        payload.personal.registrationDate,
                        payload.personal.actualAddressSameAsRegistration,
                        payload.personal.actualAddress || null,
                        payload.personal.actualAddressSince,
                        payload.personal.personalEmail || null,
                        payload.personal.workEmail || null,
                        payload.personal.primaryPhone || null,
                        payload.personal.workPhone || null,
                        payload.personal.educationLevel || null,
                        payload.personal.primaryProfession || null,
                        payload.personal.secondaryProfession || null,
                        payload.personal.languages,
                        payload.personal.notes || null,
                    ]
                );

                await client.query(
                    `
          INSERT INTO public.employee_bank_details (
            employee_id,
            bank_name,
            bank_bik,
            settlement_account,
            correspondent_account,
            mir_card_number,
            alternative_bank_name,
            alternative_account_number,
            notes,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
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
                        payload.bank.bankName || null,
                        payload.bank.bankBik || null,
                        payload.bank.settlementAccount || null,
                        payload.bank.correspondentAccount || null,
                        payload.bank.mirCardNumber || null,
                        payload.bank.alternativeBankName || null,
                        payload.bank.alternativeAccountNumber || null,
                        payload.bank.notes || null,
                    ]
                );

                await client.query(
                    `
          INSERT INTO public.employee_employment_details (
            employee_id,
            position_category,
            department_name,
            subdivision_name,
            is_flight_crew,
            is_sea_crew,
            contract_type,
            labor_book_status,
            labor_book_notes,
            foreign_work_permit_note,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
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
                        payload.employment.positionCategory || null,
                        payload.employment.departmentName || null,
                        payload.employment.subdivisionName || null,
                        payload.employment.isFlightCrew,
                        payload.employment.isSeaCrew,
                        payload.employment.contractType || null,
                        payload.employment.laborBookStatus || null,
                        payload.employment.laborBookNotes || null,
                        payload.employment.foreignWorkPermitNote || null,
                    ]
                );

                await client.query(
                    `
          INSERT INTO public.employee_military_records (
            employee_id,
            relation_to_service,
            reserve_category,
            military_rank,
            unit_composition,
            specialty_code,
            fitness_category,
            fitness_checked_at,
            commissariat_name,
            commissariat_manual,
            additional_info,
            military_registration_type,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
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
                        payload.military.relationToService || null,
                        payload.military.reserveCategory || null,
                        payload.military.militaryRank || null,
                        payload.military.unitComposition || null,
                        payload.military.specialtyCode || null,
                        payload.military.fitnessCategory || null,
                        payload.military.fitnessCheckedAt,
                        payload.military.commissariatName || null,
                        payload.military.commissariatManual || null,
                        payload.military.additionalInfo || null,
                        payload.military.militaryRegistrationType || null,
                    ]
                );

                await client.query(`DELETE FROM public.employee_identity_documents WHERE employee_id = $1`, [employeeId]);
                for (const doc of payload.identityDocuments) {
                    await client.query(
                        `
            INSERT INTO public.employee_identity_documents (
              employee_id,
              document_type,
              series_number,
              issued_by,
              department_code,
              issue_date,
              valid_until,
              is_primary
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
                        [
                            employeeId,
                            doc.documentType || null,
                            doc.seriesNumber || null,
                            doc.issuedBy || null,
                            doc.departmentCode || null,
                            doc.issueDate,
                            doc.validUntil,
                            doc.isPrimary,
                        ]
                    );
                }

                await client.query(`DELETE FROM public.employee_employment_events WHERE employee_id = $1`, [employeeId]);
                for (const event of payload.employmentEvents) {
                    await client.query(
                        `
            INSERT INTO public.employee_employment_events (
              employee_id,
              event_date,
              event_type,
              details,
              status,
              sent_date,
              external_uuid
            )
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::uuid, gen_random_uuid()))
            `,
                        [
                            employeeId,
                            event.eventDate,
                            event.eventType || null,
                            event.details || null,
                            event.status || null,
                            event.sentDate,
                            event.externalUuid,
                        ]
                    );
                }

                await client.query(`DELETE FROM public.employee_relatives WHERE employee_id = $1`, [employeeId]);
                for (const relative of payload.relatives) {
                    await client.query(
                        `
            INSERT INTO public.employee_relatives (
              employee_id,
              full_name,
              relation_type,
              birth_date,
              document_info,
              snils,
              phone,
              notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
                        [
                            employeeId,
                            relative.fullName || null,
                            relative.relationType || null,
                            relative.birthDate,
                            relative.documentInfo || null,
                            relative.snils || null,
                            relative.phone || null,
                            relative.notes || null,
                        ]
                    );
                }

                await client.query(`DELETE FROM public.employee_military_documents WHERE employee_id = $1`, [employeeId]);
                for (const doc of payload.militaryDocuments) {
                    await client.query(
                        `
            INSERT INTO public.employee_military_documents (
              employee_id,
              document_type,
              series_number,
              issued_by,
              issue_date,
              valid_until
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
                        [
                            employeeId,
                            doc.documentType || null,
                            doc.seriesNumber || null,
                            doc.issuedBy || null,
                            doc.issueDate,
                            doc.validUntil,
                        ]
                    );
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

            const updatedBaseRow = await getBaseEmployee(employeeId);
            const data = await readProfile(employeeId, updatedBaseRow);
            return res.status(200).json({ available: true, data });
        }

        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    } catch (error) {
        console.error('Manager HR profile API error:', error);
        return res.status(500).json({ error: 'Ошибка кадровой карточки сотрудника' });
    }
}
