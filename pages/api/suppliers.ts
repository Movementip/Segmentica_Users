import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

export interface Supplier {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг: number;
    created_at: string;
    количество_товаров?: number;
    общая_сумма_закупок?: number;
    закупки_в_пути?: number;
}

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

            const suppliers: Supplier[] = result.rows.map((row: any) => ({
                id: row.id,
                название: row.название,
                телефон: row.телефон,
                email: row.email,
                рейтинг: row.рейтинг,
                created_at: row.created_at,
                количество_товаров: parseInt(row.количество_товаров) || 0,
                общая_сумма_закупок: parseFloat(row.общая_сумма_закупок) || 0,
                закупки_в_пути: parseInt(row.закупки_в_пути) || 0
            }));

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
            const { название, телефон, email, рейтинг } = req.body;

            // Validate required fields
            if (!название) {
                return res.status(400).json({ error: 'Название поставщика обязательно' });
            }

            // Check if supplier with this name already exists
            const existingSupplier = await query(
                'SELECT id FROM "Поставщики" WHERE "название" = $1',
                [название]
            );

            if (existingSupplier.rows.length > 0) {
                return res.status(400).json({ error: 'Поставщик с таким названием уже существует' });
            }

            // Create new supplier
            const result = await query(`
        INSERT INTO "Поставщики" (
          "название", "телефон", "email", "рейтинг"
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, "название", "телефон", "email", "рейтинг", created_at
      `, [
                название,
                телефон || null,
                email || null,
                рейтинг || 5
            ]);

            const newSupplier: Supplier = {
                ...result.rows[0],
                количество_товаров: 0,
                общая_сумма_закупок: 0,
                закупки_в_пути: 0
            };

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