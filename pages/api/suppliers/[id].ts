import type { NextApiRequest, NextApiResponse } from 'next';
import { query, withTransaction } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import {
    buildSupplierDisplayName,
    buildSupplierPrimaryAddress,
    normalizeNullableSupplierDate,
    normalizeNullableSupplierText,
    normalizeSupplierBankAccounts,
    normalizeSupplierContragentType,
    type SupplierBankAccount,
    type SupplierContragent,
    type SupplierContragentPayload,
} from '../../../lib/supplierContragents';

export interface SupplierDetail extends SupplierContragent {
    рейтинг: number;
    ассортимент: SupplierProduct[];
    закупки: SupplierPurchase[];
}

export interface SupplierProduct {
    id: number;
    товар_id: number;
    цена: number;
    срок_поставки: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

export interface SupplierPurchase {
    id: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    заявка_id?: number;
}

type NormalizedSupplierPayload = {
    название: string | null;
    телефон: string | null;
    email: string | null;
    адрес: string | null;
    тип: string;
    рейтинг: number;
    краткоеНазвание: string | null;
    полноеНазвание: string | null;
    фамилия: string | null;
    имя: string | null;
    отчество: string | null;
    инн: string | null;
    кпп: string | null;
    огрн: string | null;
    огрнип: string | null;
    окпо: string | null;
    адресРегистрации: string | null;
    адресПечати: string | null;
    паспортСерия: string | null;
    паспортНомер: string | null;
    паспортКемВыдан: string | null;
    паспортДатаВыдачи: string | null;
    паспортКодПодразделения: string | null;
    комментарий: string | null;
    bankAccounts: SupplierBankAccount[];
};

const mapBankAccountRow = (row: any): SupplierBankAccount => ({
    id: Number(row.id),
    name: String(row.название || ''),
    bik: row.бик == null ? null : String(row.бик),
    bankName: row.банк == null ? null : String(row.банк),
    correspondentAccount: row.к_с == null ? null : String(row.к_с),
    settlementAccount: row.р_с == null ? null : String(row.р_с),
    isPrimary: Boolean(row.основной),
    sortOrder: Number(row.sort_order) || 0,
});

const mapSupplierRow = (row: any, bankAccounts?: SupplierBankAccount[]): SupplierContragent => ({
    id: Number(row.id),
    название: String(row.название || ''),
    телефон: row.телефон == null ? null : String(row.телефон),
    email: row.email == null ? null : String(row.email),
    адрес: buildSupplierPrimaryAddress({
        адрес: row.адрес == null ? null : String(row.адрес),
        адресРегистрации: row.адрес_регистрации == null ? null : String(row.адрес_регистрации),
        адресПечати: row.адрес_печати == null ? null : String(row.адрес_печати),
    }),
    тип: row.тип == null ? null : String(row.тип),
    created_at: row.created_at == null ? null : String(row.created_at),
    рейтинг: row.рейтинг == null ? null : Number(row.рейтинг),
    краткоеНазвание: row.краткое_название == null ? null : String(row.краткое_название),
    полноеНазвание: row.полное_название == null ? null : String(row.полное_название),
    фамилия: row.фамилия == null ? null : String(row.фамилия),
    имя: row.имя == null ? null : String(row.имя),
    отчество: row.отчество == null ? null : String(row.отчество),
    инн: row.инн == null ? null : String(row.инн),
    кпп: row.кпп == null ? null : String(row.кпп),
    огрн: row.огрн == null ? null : String(row.огрн),
    огрнип: row.огрнип == null ? null : String(row.огрнип),
    окпо: row.окпо == null ? null : String(row.окпо),
    адресРегистрации: row.адрес_регистрации == null ? null : String(row.адрес_регистрации),
    адресПечати: row.адрес_печати == null ? null : String(row.адрес_печати),
    паспортСерия: row.паспорт_серия == null ? null : String(row.паспорт_серия),
    паспортНомер: row.паспорт_номер == null ? null : String(row.паспорт_номер),
    паспортКемВыдан: row.паспорт_кем_выдан == null ? null : String(row.паспорт_кем_выдан),
    паспортДатаВыдачи: row.паспорт_дата_выдачи == null ? null : String(row.паспорт_дата_выдачи),
    паспортКодПодразделения: row.паспорт_код_подразделения == null ? null : String(row.паспорт_код_подразделения),
    комментарий: row.комментарий == null ? null : String(row.комментарий),
    bankAccounts,
});

const buildSupplierPayload = (body: Partial<SupplierContragentPayload>): NormalizedSupplierPayload => {
    const тип = normalizeSupplierContragentType(body.тип);
    const payload: NormalizedSupplierPayload = {
        название: normalizeNullableSupplierText(body.название),
        телефон: normalizeNullableSupplierText(body.телефон),
        email: normalizeNullableSupplierText(body.email),
        адрес: normalizeNullableSupplierText(body.адрес),
        тип,
        рейтинг: Number(body.рейтинг) || 5,
        краткоеНазвание: normalizeNullableSupplierText(body.краткоеНазвание),
        полноеНазвание: normalizeNullableSupplierText(body.полноеНазвание),
        фамилия: normalizeNullableSupplierText(body.фамилия),
        имя: normalizeNullableSupplierText(body.имя),
        отчество: normalizeNullableSupplierText(body.отчество),
        инн: normalizeNullableSupplierText(body.инн),
        кпп: normalizeNullableSupplierText(body.кпп),
        огрн: normalizeNullableSupplierText(body.огрн),
        огрнип: normalizeNullableSupplierText(body.огрнип),
        окпо: normalizeNullableSupplierText(body.окпо),
        адресРегистрации: normalizeNullableSupplierText(body.адресРегистрации),
        адресПечати: normalizeNullableSupplierText(body.адресПечати),
        паспортСерия: normalizeNullableSupplierText(body.паспортСерия),
        паспортНомер: normalizeNullableSupplierText(body.паспортНомер),
        паспортКемВыдан: normalizeNullableSupplierText(body.паспортКемВыдан),
        паспортДатаВыдачи: normalizeNullableSupplierDate(body.паспортДатаВыдачи),
        паспортКодПодразделения: normalizeNullableSupplierText(body.паспортКодПодразделения),
        комментарий: normalizeNullableSupplierText(body.комментарий),
        bankAccounts: normalizeSupplierBankAccounts(body.bankAccounts),
    };

    return {
        ...payload,
        название: buildSupplierDisplayName(payload),
        адрес: buildSupplierPrimaryAddress(payload),
    };
};

const replaceSupplierBankAccounts = async (supplierId: number, accounts: SupplierBankAccount[]) => {
    await query('DELETE FROM "Расчетные_счета_поставщиков" WHERE "поставщик_id" = $1', [supplierId]);

    for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        await query(
            `
                INSERT INTO "Расчетные_счета_поставщиков" (
                    "поставщик_id", "название", "бик", "банк", "к_с", "р_с", "основной", sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                supplierId,
                account.name,
                account.bik || null,
                account.bankName || null,
                account.correspondentAccount || null,
                account.settlementAccount || null,
                Boolean(account.isPrimary),
                typeof account.sortOrder === 'number' ? account.sortOrder : index,
            ]
        );
    }
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SupplierDetail | { error: string }>
) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'suppliers.view');
        if (!actor) return;
        try {
            const canAssortmentView = Boolean(actor.permissions?.includes('suppliers.assortment.view'));
            const canPurchasesHistoryView = Boolean(actor.permissions?.includes('suppliers.purchases_history.view'));

            // Получаем основную информацию о поставщике
            const supplierResult = await query(`
        SELECT * FROM "Поставщики" WHERE id = $1
      `, [id]);

            if (supplierResult.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            const supplier = supplierResult.rows[0];

            const bankAccountsRes = await query(
                `
                    SELECT *
                    FROM "Расчетные_счета_поставщиков"
                    WHERE "поставщик_id" = $1
                    ORDER BY "основной" DESC, sort_order ASC, id ASC
                `,
                [id]
            );

            // Получаем ассортимент поставщика
            const productsResult = canAssortmentView
                ? await query(`
        SELECT 
          ап.*,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица_измерения
        FROM "Ассортимент_поставщиков" ап
        LEFT JOIN "Товары" т ON ап."товар_id" = т.id
        WHERE ап."поставщик_id" = $1
        ORDER BY т."название"
      `, [id])
                : { rows: [] as any[] };

            const products: SupplierProduct[] = productsResult.rows.map((row: any) => ({
                id: row.id,
                товар_id: row.товар_id,
                цена: parseFloat(row.цена),
                срок_поставки: row.срок_поставки,
                товар_название: row.товар_название,
                товар_артикул: row.товар_артикул,
                товар_категория: row.товар_категория,
                товар_единица_измерения: row.товар_единица_измерения || 'шт'
            }));

            // Получаем закупки у поставщика
            const purchasesResult = canPurchasesHistoryView
                ? await query(`
        SELECT * FROM "Закупки" 
        WHERE "поставщик_id" = $1
        ORDER BY "дата_заказа" DESC
        LIMIT 20
      `, [id])
                : { rows: [] as any[] };

            const purchases: SupplierPurchase[] = purchasesResult.rows.map((row: any) => ({
                id: row.id,
                дата_заказа: row.дата_заказа,
                дата_поступления: row.дата_поступления,
                статус: row.статус,
                общая_сумма: parseFloat(row.общая_сумма) || 0,
                заявка_id: row.заявка_id
            }));

            const supplierCard = mapSupplierRow(
                supplier,
                bankAccountsRes.rows.map(mapBankAccountRow)
            );

            const supplierDetail: SupplierDetail = {
                ...supplierCard,
                рейтинг: Number(supplier.рейтинг) || 5,
                ассортимент: products,
                закупки: purchases
            };

            res.status(200).json(supplierDetail);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения детальной информации о поставщике: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'suppliers.edit');
        if (!actor) return;
        try {
            const normalizedPayload = buildSupplierPayload(req.body as Partial<SupplierContragentPayload>);
            const { название, телефон, email, тип } = normalizedPayload;

            if (!id) {
                return res.status(400).json({ error: 'ID поставщика обязателен' });
            }

            if (!название) {
                return res.status(400).json({ error: 'Название поставщика обязательно' });
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            const check = await query('SELECT id FROM "Поставщики" WHERE id = $1', [id]);
            if (check.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            const updated = await withTransaction(async () => {
                const result = await query(
                    `
                        UPDATE "Поставщики"
                        SET "название" = $1,
                            "телефон" = $2,
                            "email" = $3,
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
                        RETURNING *
                    `,
                    [
                        String(название).trim(),
                        телефон ? String(телефон).trim() : null,
                        email ? String(email).trim() : null,
                        тип,
                        normalizedPayload.рейтинг || 5,
                        normalizedPayload.краткоеНазвание || null,
                        normalizedPayload.полноеНазвание || null,
                        normalizedPayload.фамилия || null,
                        normalizedPayload.имя || null,
                        normalizedPayload.отчество || null,
                        normalizedPayload.инн || null,
                        normalizedPayload.кпп || null,
                        normalizedPayload.огрн || null,
                        normalizedPayload.огрнип || null,
                        normalizedPayload.окпо || null,
                        normalizedPayload.адресРегистрации || null,
                        normalizedPayload.адресПечати || null,
                        normalizedPayload.паспортСерия || null,
                        normalizedPayload.паспортНомер || null,
                        normalizedPayload.паспортКемВыдан || null,
                        normalizedPayload.паспортДатаВыдачи || null,
                        normalizedPayload.паспортКодПодразделения || null,
                        normalizedPayload.комментарий || null,
                        id,
                    ]
                );

                const bankAccounts = normalizedPayload.bankAccounts || [];
                await replaceSupplierBankAccounts(Number(id), bankAccounts);

                return mapSupplierRow(result.rows[0], bankAccounts);
            });

            res.status(200).json(updated as any);
        } catch (error) {
            console.error('Error updating supplier:', error);
            res.status(500).json({
                error: 'Ошибка обновления поставщика: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'),
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}