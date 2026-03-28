import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

export interface Client {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
    created_at?: string;
}

interface CreateClientRequest {
    название: string;
    телефон?: string;
    email?: string;
    адрес?: string;
    тип?: string;
}

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

                const client: Client = {
                    id: result.rows[0].id,
                    название: result.rows[0].название,
                    телефон: result.rows[0].телефон,
                    email: result.rows[0].email,
                    адрес: result.rows[0].адрес,
                    тип: result.rows[0].тип,
                    created_at: result.rows[0].created_at
                };

                res.status(200).json(client);
            } else {
                // Fetch all clients
                const result = await query(`
          SELECT * FROM "Клиенты"
          ORDER BY "название"
        `);

                const clients: Client[] = result.rows.map((row: any) => ({
                    id: row.id,
                    название: row.название,
                    телефон: row.телефон,
                    email: row.email,
                    адрес: row.адрес,
                    тип: row.тип,
                    created_at: row.created_at
                }));

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
            const { название, телефон, email, адрес, тип }: CreateClientRequest = req.body;

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
            const result = await query(`
        INSERT INTO "Клиенты" ("название", "телефон", "email", "адрес", "тип")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [название, телефон || null, email || null, адрес || null, тип || 'розничный']);

            const newClient: Client = {
                id: result.rows[0].id,
                название: result.rows[0].название,
                телефон: result.rows[0].телефон,
                email: result.rows[0].email,
                адрес: result.rows[0].адрес,
                тип: result.rows[0].тип,
                created_at: result.rows[0].created_at
            };

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
            const { id, название, телефон, email, адрес, тип } = req.body as Partial<Client> & { id?: number };

            if (!id) {
                return res.status(400).json({ error: 'ID клиента обязателен' });
            }

            if (!название || !String(название).trim()) {
                return res.status(400).json({ error: 'Название клиента обязательно' });
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            const updateResult = await query(
                `UPDATE "Клиенты"
         SET "название" = $1,
             "телефон" = $2,
             "email" = $3,
             "адрес" = $4,
             "тип" = $5
         WHERE id = $6
         RETURNING *`,
                [
                    String(название).trim(),
                    телефон ? String(телефон).trim() : null,
                    email ? String(email).trim() : null,
                    адрес ? String(адрес).trim() : null,
                    тип ? String(тип).trim() : null,
                    id,
                ]
            );

            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'Клиент не найден' });
            }

            const updatedClient: Client = {
                id: updateResult.rows[0].id,
                название: updateResult.rows[0].название,
                телефон: updateResult.rows[0].телефон,
                email: updateResult.rows[0].email,
                адрес: updateResult.rows[0].адрес,
                тип: updateResult.rows[0].тип,
                created_at: updateResult.rows[0].created_at,
            };

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