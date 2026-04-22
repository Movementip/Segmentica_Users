import type { NextApiRequest, NextApiResponse } from 'next';
import { query, withTransaction } from '../../lib/db';
import { requirePermission } from '../../lib/auth';
import {
    buildClientDisplayName,
    buildClientPrimaryAddress,
    normalizeBankAccounts,
    normalizeClientContragentType,
    normalizeNullableDate,
    normalizeNullableText,
    type ClientBankAccount,
    type ClientContragent,
    type ClientContragentPayload,
} from '../../lib/clientContragents';

export interface Client extends ClientContragent { }

interface CreateClientRequest extends Partial<ClientContragentPayload> { }

type NormalizedClientPayload = {
    название: string | null;
    телефон: string | null;
    email: string | null;
    адрес: string | null;
    тип: string;
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
    bankAccounts: ClientBankAccount[];
};

const mapBankAccountRow = (row: any): ClientBankAccount => ({
    id: Number(row.id),
    name: String(row.название || ''),
    bik: row.бик == null ? null : String(row.бик),
    bankName: row.банк == null ? null : String(row.банк),
    correspondentAccount: row.к_с == null ? null : String(row.к_с),
    settlementAccount: row.р_с == null ? null : String(row.р_с),
    isPrimary: Boolean(row.основной),
    sortOrder: Number(row.sort_order) || 0,
});

const mapClientRow = (row: any, bankAccounts?: ClientBankAccount[]): Client => ({
    id: Number(row.id),
    название: String(row.название || ''),
    телефон: row.телефон == null ? null : String(row.телефон),
    email: row.email == null ? null : String(row.email),
    адрес: row.адрес == null ? null : String(row.адрес),
    тип: row.тип == null ? null : String(row.тип),
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
});

const buildClientPayload = (body: Partial<ClientContragentPayload>): NormalizedClientPayload => {
    const тип = normalizeClientContragentType(body.тип);
    const payload: NormalizedClientPayload = {
        название: normalizeNullableText(body.название),
        телефон: normalizeNullableText(body.телефон),
        email: normalizeNullableText(body.email),
        адрес: normalizeNullableText(body.адрес),
        тип,
        краткоеНазвание: normalizeNullableText(body.краткоеНазвание),
        полноеНазвание: normalizeNullableText(body.полноеНазвание),
        фамилия: normalizeNullableText(body.фамилия),
        имя: normalizeNullableText(body.имя),
        отчество: normalizeNullableText(body.отчество),
        инн: normalizeNullableText(body.инн),
        кпп: normalizeNullableText(body.кпп),
        огрн: normalizeNullableText(body.огрн),
        огрнип: normalizeNullableText(body.огрнип),
        окпо: normalizeNullableText(body.окпо),
        адресРегистрации: normalizeNullableText(body.адресРегистрации),
        адресПечати: normalizeNullableText(body.адресПечати),
        паспортСерия: normalizeNullableText(body.паспортСерия),
        паспортНомер: normalizeNullableText(body.паспортНомер),
        паспортКемВыдан: normalizeNullableText(body.паспортКемВыдан),
        паспортДатаВыдачи: normalizeNullableDate(body.паспортДатаВыдачи),
        паспортКодПодразделения: normalizeNullableText(body.паспортКодПодразделения),
        комментарий: normalizeNullableText(body.комментарий),
        bankAccounts: normalizeBankAccounts(body.bankAccounts),
    };

    const название = buildClientDisplayName(payload);
    const адрес = buildClientPrimaryAddress(payload);

    return {
        ...payload,
        название,
        адрес,
    };
};

const replaceClientBankAccounts = async (clientId: number, accounts: ClientBankAccount[]) => {
    await query('DELETE FROM "Расчетные_счета_клиентов" WHERE "клиент_id" = $1', [clientId]);

    for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        await query(
            `
                INSERT INTO "Расчетные_счета_клиентов" (
                    "клиент_id", "название", "бик", "банк", "к_с", "р_с", "основной", sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                clientId,
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
    res: NextApiResponse<Client[] | Client | { error: string } | { message: string }>
) {
    if (req.method === 'GET') {
        const { id } = req.query;

        const actor = await requirePermission(req, res, id ? 'clients.view' : 'clients.list');
        if (!actor) return;
        try {
            if (id) {
                // Fetch single client by ID
                const result = await query(
                    'SELECT * FROM "Клиенты" WHERE id = $1',
                    [id]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Клиент не найден' });
                }

                const bankAccountsRes = await query(
                    `
                        SELECT *
                        FROM "Расчетные_счета_клиентов"
                        WHERE "клиент_id" = $1
                        ORDER BY "основной" DESC, sort_order ASC, id ASC
                    `,
                    [id]
                );

                const client: Client = mapClientRow(
                    result.rows[0],
                    bankAccountsRes.rows.map(mapBankAccountRow)
                );

                res.status(200).json(client);
            } else {
                // Fetch all clients
                const result = await query(`
          SELECT * FROM "Клиенты"
          ORDER BY "название"
        `);

                const clients: Client[] = result.rows.map((row: any) => mapClientRow(row));

                res.status(200).json(clients);
            }
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения клиентов: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'clients.create');
        if (!actor) return;
        try {
            const normalizedPayload = buildClientPayload(req.body as CreateClientRequest);
            const { название, телефон, email, адрес, тип } = normalizedPayload;

            // Validate required fields
            if (!название) {
                return res.status(400).json({ error: 'Название клиента обязательно' });
            }

            // Validate email format if provided
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            // Check if client with this name already exists
            const existingClient = await query(
                'SELECT id FROM "Клиенты" WHERE "название" = $1',
                [название]
            );

            if (existingClient.rows.length > 0) {
                return res.status(400).json({ error: 'Клиент с таким названием уже существует' });
            }

            // Create new client
            const newClient = await withTransaction(async () => {
                const result = await query(
                    `
                        INSERT INTO "Клиенты" (
                            "название", "телефон", "email", "адрес", "тип", "краткое_название", "полное_название",
                            "фамилия", "имя", "отчество", "инн", "кпп", "огрн", "огрнип", "окпо",
                            "адрес_регистрации", "адрес_печати", "паспорт_серия", "паспорт_номер",
                            "паспорт_кем_выдан", "паспорт_дата_выдачи", "паспорт_код_подразделения", "комментарий"
                        )
                        VALUES (
                            $1, $2, $3, $4, $5, $6, $7,
                            $8, $9, $10, $11, $12, $13, $14, $15,
                            $16, $17, $18, $19, $20, $21, $22, $23
                        )
                        RETURNING *
                    `,
                    [
                        название,
                        телефон || null,
                        email || null,
                        адрес || null,
                        тип,
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
                const clientId = Number(created.id);
                const bankAccounts = normalizedPayload.bankAccounts || [];
                await replaceClientBankAccounts(clientId, bankAccounts);

                return mapClientRow(created, bankAccounts);
            });

            res.status(201).json(newClient);
        } catch (error) {
            console.error('Error creating client:', error);
            res.status(500).json({
                error: 'Ошибка создания клиента: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'clients.edit');
        if (!actor) return;
        try {
            const { id, ...body } = req.body as Partial<Client> & { id?: number };

            if (!id) {
                return res.status(400).json({ error: 'ID клиента обязателен' });
            }

            const normalizedPayload = buildClientPayload(body);
            const { название, телефон, email, адрес, тип } = normalizedPayload;

            if (!название || !String(название).trim()) {
                return res.status(400).json({ error: 'Название клиента обязательно' });
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            const updateResult = await withTransaction(async () => {
                const result = await query(
                    `
                        UPDATE "Клиенты"
                        SET "название" = $1,
                            "телефон" = $2,
                            "email" = $3,
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
                        RETURNING *
                    `,
                    [
                        String(название).trim(),
                        телефон ? String(телефон).trim() : null,
                        email ? String(email).trim() : null,
                        адрес ? String(адрес).trim() : null,
                        тип ? String(тип).trim() : null,
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

                if (result.rows.length === 0) {
                    return result;
                }

                const bankAccounts = normalizedPayload.bankAccounts || [];
                await replaceClientBankAccounts(Number(id), bankAccounts);
                return {
                    rows: [mapClientRow(result.rows[0], bankAccounts)],
                };
            });

            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'Клиент не найден' });
            }

            const updatedClient: Client = updateResult.rows[0] as Client;

            res.status(200).json(updatedClient);
        } catch (error) {
            console.error('Error updating client:', error);
            res.status(500).json({
                error: 'Ошибка обновления клиента: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'),
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'clients.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID клиента обязателен' });
            }

            // Check if client exists
            const clientCheck = await query(
                'SELECT id FROM "Клиенты" WHERE id = $1',
                [id]
            );

            if (clientCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Клиент не найден' });
            }

            // Check if client has any orders
            const ordersCheck = await query(
                'SELECT COUNT(*) as count FROM "Заявки" WHERE "клиент_id" = $1',
                [id]
            );

            if (parseInt(ordersCheck.rows[0].count) > 0) {
                return res.status(400).json({ error: 'Нельзя удалить клиента, у которого есть заявки' });
            }

            // Delete client
            await query('DELETE FROM "Клиенты" WHERE id = $1', [id]);

            res.status(200).json({ message: 'Клиент успешно удален' });
        } catch (error) {
            console.error('Error deleting client:', error);
            res.status(500).json({
                error: 'Ошибка удаления клиента: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}