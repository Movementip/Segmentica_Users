import type { NextApiRequest, NextApiResponse } from 'next';
import { query, withTransaction } from '../../lib/db';
import { requirePermission } from '../../lib/auth';
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
} from '../../lib/supplierContragents';

export interface Supplier extends SupplierContragent {
    количество_товаров?: number;
    общая_сумма_закупок?: number;
    закупки_в_пути?: number;
}

interface CreateSupplierRequest extends Partial<SupplierContragentPayload> { }

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

const mapSupplierRow = (row: any, bankAccounts?: SupplierBankAccount[]): Supplier => ({
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
    рейтинг: row.рейтинг == null ? null : Number(row.рейтинг),
    created_at: row.created_at == null ? null : String(row.created_at),
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
    количество_товаров: typeof row.количество_товаров === 'undefined' ? undefined : parseInt(row.количество_товаров, 10) || 0,
    общая_сумма_закупок: typeof row.общая_сумма_закупок === 'undefined' ? undefined : parseFloat(row.общая_сумма_закупок) || 0,
    закупки_в_пути: typeof row.закупки_в_пути === 'undefined' ? undefined : parseInt(row.закупки_в_пути, 10) || 0,
});

const buildSupplierPayload = (body: CreateSupplierRequest): NormalizedSupplierPayload => {
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
    res: NextApiResponse<Supplier[] | Supplier | { error: string } | { message: string }>
) {
    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'suppliers.list');
        if (!actor) return;
        try {
            // Получаем поставщиков с дополнительной статистикой
            const result = await query(`
        SELECT 
          п.*,
          COALESCE(ап_stats.количество_товаров, 0) as количество_товаров,
          COALESCE(зак_stats.общая_сумма_закупок, 0) as общая_сумма_закупок,
          COALESCE(зак_stats.закупки_в_пути, 0) as закупки_в_пути
        FROM "Поставщики" п
        LEFT JOIN (
          SELECT "поставщик_id", COUNT(*) as количество_товаров
          FROM "Ассортимент_поставщиков"
          GROUP BY "поставщик_id"
        ) ап_stats ON п.id = ап_stats."поставщик_id"
        LEFT JOIN (
          SELECT 
            "поставщик_id",
            COALESCE(SUM("общая_сумма"), 0) as общая_сумма_закупок,
            COUNT(CASE WHEN LOWER(COALESCE("статус", '')) = 'в пути' THEN 1 END) as закупки_в_пути
          FROM "Закупки"
          GROUP BY "поставщик_id"
        ) зак_stats ON п.id = зак_stats."поставщик_id"
        ORDER BY п."рейтинг" DESC, п."название" ASC
      `);

            const suppliers: Supplier[] = result.rows.map((row: any) => mapSupplierRow(row));

            res.status(200).json(suppliers);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения поставщиков из базы данных: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'suppliers.create');
        if (!actor) return;
        try {
            const normalizedPayload = buildSupplierPayload(req.body as CreateSupplierRequest);
            const { название, телефон, email, тип } = normalizedPayload;

            // Validate required fields
            if (!название) {
                return res.status(400).json({ error: 'Название поставщика обязательно' });
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            // Check if supplier with this name already exists
            const existingSupplier = await query(
                'SELECT id FROM "Поставщики" WHERE "название" = $1',
                [название]
            );

            if (existingSupplier.rows.length > 0) {
                return res.status(400).json({ error: 'Поставщик с таким названием уже существует' });
            }

            const newSupplier = await withTransaction(async () => {
                const result = await query(
                    `
                        INSERT INTO "Поставщики" (
                            "название", "телефон", "email", "тип", "рейтинг", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13, $14, $15,
                            $16, $17, $18, $19, $20, $21, $22
                        )
                        RETURNING *
                    `,
                    [
                        название,
                        телефон || null,
                        email || null,
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
                    ]
                );

                const created = result.rows[0];
                const supplierId = Number(created.id);
                const bankAccounts = normalizedPayload.bankAccounts || [];
                await replaceSupplierBankAccounts(supplierId, bankAccounts);

                return {
                    ...mapSupplierRow(created, bankAccounts),
                    количество_товаров: 0,
                    общая_сумма_закупок: 0,
                    закупки_в_пути: 0,
                } as Supplier;
            });

            res.status(201).json(newSupplier);
        } catch (error) {
            console.error('Error creating supplier:', error);
            res.status(500).json({
                error: 'Ошибка создания поставщика: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'suppliers.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID поставщика обязателен' });
            }

            // Check if supplier has any purchases
            const purchasesResult = await query(
                'SELECT COUNT(*) as count FROM "Закупки" WHERE "поставщик_id" = $1',
                [id]
            );

            if (parseInt(purchasesResult.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'Нельзя удалить поставщика, у которого есть закупки. Сначала удалите связанные закупки.'
                });
            }

            // Check if supplier has any products in assortment
            const assortmentResult = await query(
                'SELECT COUNT(*) as count FROM "Ассортимент_поставщиков" WHERE "поставщик_id" = $1',
                [id]
            );

            if (parseInt(assortmentResult.rows[0].count) > 0) {
                // Remove from assortment first
                await query(
                    'DELETE FROM "Ассортимент_поставщиков" WHERE "поставщик_id" = $1',
                    [id]
                );
            }

            // Delete the supplier
            const deleteResult = await query(
                'DELETE FROM "Поставщики" WHERE id = $1 RETURNING id',
                [id]
            );

            if (deleteResult.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            res.status(200).json({ message: 'Поставщик успешно удален' });
        } catch (error) {
            console.error('Error deleting supplier:', error);
            res.status(500).json({
                error: 'Ошибка удаления поставщика: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}