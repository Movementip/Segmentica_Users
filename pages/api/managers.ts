import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

export interface Manager {
    id: number;
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен: boolean;
    created_at: string;
}

interface CreateManagerRequest {
    фио: string;
    должность: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен?: boolean;
}

interface UpdateManagerRequest {
    id: number;
    фио?: string;
    должность?: string;
    телефон?: string;
    email?: string;
    ставка?: number;
    дата_приема?: string;
    активен?: boolean;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Manager[] | Manager | { error: string } | { message: string }>
) {
    if (req.method === 'GET') {
        const { id } = req.query;

        const actor = await requirePermission(req, res, id ? 'managers.view' : 'managers.list');
        if (!actor) return;
        try {
            if (id) {
                // Fetch single manager by ID
                const result = await query(
                    'SELECT * FROM "Сотрудники" WHERE id = $1',
                    [id]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Сотрудник не найден' });
                }

                const manager: Manager = {
                    id: result.rows[0].id,
                    фио: result.rows[0].фио,
                    должность: result.rows[0].должность,
                    телефон: result.rows[0].телефон,
                    email: result.rows[0].email,
                    ставка: result.rows[0].ставка ? parseFloat(result.rows[0].ставка) : undefined,
                    дата_приема: result.rows[0].дата_приема,
                    активен: result.rows[0].активен,
                    created_at: result.rows[0].created_at
                };

                res.status(200).json(manager);
            } else {
                // Fetch all managers
                const result = await query(`
          SELECT * FROM "Сотрудники"
          ORDER BY "фио"
        `);

                const managers: Manager[] = result.rows.map((row: any) => ({
                    id: row.id,
                    фио: row.фио,
                    должность: row.должность,
                    телефон: row.телефон,
                    email: row.email,
                    ставка: row.ставка ? parseFloat(row.ставка) : undefined,
                    дата_приема: row.дата_приема,
                    активен: row.активен,
                    created_at: row.created_at
                }));

                res.status(200).json(managers);
            }
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения сотрудников: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'managers.create');
        if (!actor) return;
        try {
            const { фио, должность, телефон, email, ставка, дата_приема, активен }: CreateManagerRequest = req.body;

            // Validate required fields
            if (!фио || !должность) {
                return res.status(400).json({ error: 'ФИО и должность обязательны' });
            }

            // Validate email format if provided
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            // Check if manager with this name already exists
            const existingManager = await query(
                'SELECT id FROM "Сотрудники" WHERE "фио" = $1',
                [фио]
            );

            if (existingManager.rows.length > 0) {
                return res.status(400).json({ error: 'Сотрудник с таким ФИО уже существует' });
            }

            // Create new manager
            const result = await query(`
        INSERT INTO "Сотрудники" ("фио", "должность", "телефон", "email", "ставка", "дата_приема", "активен")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [фио, должность, телефон || null, email || null, ставка || null, дата_приема || null, активен !== undefined ? активен : true]);

            const newManager: Manager = {
                id: result.rows[0].id,
                фио: result.rows[0].фио,
                должность: result.rows[0].должность,
                телефон: result.rows[0].телефон,
                email: result.rows[0].email,
                ставка: result.rows[0].ставка ? parseFloat(result.rows[0].ставка) : undefined,
                дата_приема: result.rows[0].дата_приема,
                активен: result.rows[0].активен,
                created_at: result.rows[0].created_at
            };

            res.status(201).json(newManager);
        } catch (error) {
            console.error('Error creating manager:', error);
            res.status(500).json({
                error: 'Ошибка создания сотрудника: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'managers.edit');
        if (!actor) return;
        try {
            const { id, фио, должность, телефон, email, ставка, дата_приема, активен }: UpdateManagerRequest = req.body;

            // Validate required fields
            if (!id) {
                return res.status(400).json({ error: 'ID сотрудника обязателен' });
            }

            // Validate email format if provided
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Некорректный формат email' });
            }

            // Check if manager exists
            const managerCheck = await query(
                'SELECT id FROM "Сотрудники" WHERE id = $1',
                [id]
            );

            if (managerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Сотрудник не найден' });
            }

            // Update manager
            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (фио !== undefined) {
                updateFields.push(`"фио" = $${paramCount}`);
                values.push(фио);
                paramCount++;
            }

            if (должность !== undefined) {
                updateFields.push(`"должность" = $${paramCount}`);
                values.push(должность);
                paramCount++;
            }

            if (телефон !== undefined) {
                updateFields.push(`"телефон" = $${paramCount}`);
                values.push(телефон);
                paramCount++;
            }

            if (email !== undefined) {
                updateFields.push(`"email" = $${paramCount}`);
                values.push(email);
                paramCount++;
            }

            if (ставка !== undefined) {
                updateFields.push(`"ставка" = $${paramCount}`);
                values.push(ставка);
                paramCount++;
            }

            if (дата_приема !== undefined) {
                updateFields.push(`"дата_приема" = $${paramCount}`);
                values.push(дата_приема);
                paramCount++;
            }

            if (активен !== undefined) {
                updateFields.push(`"активен" = $${paramCount}`);
                values.push(активен);
                paramCount++;
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            values.push(id);

            const result = await query(`
        UPDATE "Сотрудники" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Сотрудник не найден' });
            }

            const updatedManager: Manager = {
                id: result.rows[0].id,
                фио: result.rows[0].фио,
                должность: result.rows[0].должность,
                телефон: result.rows[0].телефон,
                email: result.rows[0].email,
                ставка: result.rows[0].ставка ? parseFloat(result.rows[0].ставка) : undefined,
                дата_приема: result.rows[0].дата_приема,
                активен: result.rows[0].активен,
                created_at: result.rows[0].created_at
            };

            res.status(200).json(updatedManager);
        } catch (error) {
            console.error('Error updating manager:', error);
            res.status(500).json({
                error: 'Ошибка обновления сотрудника: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'managers.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID сотрудника обязателен' });
            }

            // Check if manager exists
            const managerCheck = await query(
                'SELECT id FROM "Сотрудники" WHERE id = $1',
                [id]
            );

            if (managerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Сотрудник не найден' });
            }

            // Check if manager has any orders
            const ordersCheck = await query(
                'SELECT COUNT(*) as count FROM "Заявки" WHERE "менеджер_id" = $1',
                [id]
            );

            if (parseInt(ordersCheck.rows[0].count) > 0) {
                return res.status(400).json({ error: 'Нельзя удалить сотрудника, у которого есть заявки' });
            }

            // Delete manager
            await query('DELETE FROM "Сотрудники" WHERE id = $1', [id]);

            res.status(200).json({ message: 'Сотрудник успешно удален' });
        } catch (error) {
            console.error('Error deleting manager:', error);
            res.status(500).json({
                error: 'Ошибка удаления сотрудника: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}