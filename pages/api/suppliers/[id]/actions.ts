import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import { requirePermission } from '../../../../lib/auth';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { id } = req.query; // supplier id

    if (req.method === 'POST') {
        // Add product to supplier's assortment
        const actor = await requirePermission(req, res, 'suppliers.edit');
        if (!actor) return;
        try {
            const { товар_id, цена, срок_поставки } = req.body;
            const normalizedProductId = Number(товар_id) || 0;
            const normalizedPrice = Number(цена);
            const normalizedLeadTime = Number(срок_поставки);

            // Validate required fields
            if (!normalizedProductId || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || !Number.isFinite(normalizedLeadTime) || normalizedLeadTime < 0) {
                return res.status(400).json({
                    error: 'Товар, цена и срок поставки обязательны'
                });
            }

            // Validate supplier exists
            const supplierCheck = await query(
                'SELECT id FROM "Поставщики" WHERE id = $1',
                [id]
            );

            if (supplierCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            // Validate product exists
            const productCheck = await query(
                'SELECT id FROM "Товары" WHERE id = $1',
                [normalizedProductId]
            );

            if (productCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Товар не найден' });
            }

            // Check if this product is already in supplier's assortment
            const existingAssortment = await query(
                'SELECT id FROM "Ассортимент_поставщиков" WHERE "поставщик_id" = $1 AND "товар_id" = $2',
                [id, normalizedProductId]
            );

            if (existingAssortment.rows.length > 0) {
                return res.status(400).json({
                    error: 'Этот товар уже есть в ассортименте поставщика'
                });
            }

            // Add product to supplier's assortment
            await query(`
        INSERT INTO "Ассортимент_поставщиков" (
          "поставщик_id", "товар_id", "цена", "срок_поставки"
        ) VALUES ($1, $2, $3, $4)
      `, [id, normalizedProductId, normalizedPrice, normalizedLeadTime]);

            res.status(201).json({
                message: 'Товар успешно добавлен в ассортимент поставщика'
            });
        } catch (error) {
            console.error('Error adding product to supplier:', error);
            res.status(500).json({
                error: 'Ошибка добавления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PATCH') {
        const actor = await requirePermission(req, res, 'suppliers.edit');
        if (!actor) return;
        try {
            const { товар_id, цена, срок_поставки } = req.body;
            const normalizedProductId = Number(товар_id) || 0;
            const normalizedPrice = Number(цена);
            const normalizedLeadTime = Number(срок_поставки);

            if (!normalizedProductId || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || !Number.isFinite(normalizedLeadTime) || normalizedLeadTime < 0) {
                return res.status(400).json({ error: 'Нужны корректные товар, цена и срок поставки' });
            }

            const result = await query(
                `
                    UPDATE "Ассортимент_поставщиков"
                    SET "цена" = $1,
                        "срок_поставки" = $2
                    WHERE "поставщик_id" = $3
                      AND "товар_id" = $4
                `,
                [normalizedPrice, normalizedLeadTime, id, normalizedProductId]
            );

            if ((result.rowCount || 0) === 0) {
                return res.status(404).json({ error: 'Позиция ассортимента не найдена' });
            }

            res.status(200).json({
                message: 'Позиция ассортимента обновлена'
            });
        } catch (error) {
            console.error('Error updating supplier assortment item:', error);
            res.status(500).json({
                error: 'Ошибка обновления ассортимента: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        // Remove product from supplier's assortment
        const actor = await requirePermission(req, res, 'suppliers.edit');
        if (!actor) return;
        try {
            const { товар_id } = req.query;

            if (!товар_id) {
                return res.status(400).json({ error: 'ID товара обязателен' });
            }

            // Remove product from supplier's assortment
            const result = await query(
                'DELETE FROM "Ассортимент_поставщиков" WHERE "поставщик_id" = $1 AND "товар_id" = $2',
                [id, товар_id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: 'Товар не найден в ассортименте поставщика'
                });
            }

            res.status(200).json({
                message: 'Товар успешно удален из ассортимента поставщика'
            });
        } catch (error) {
            console.error('Error removing product from supplier:', error);
            res.status(500).json({
                error: 'Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        // Update supplier rating
        const actor = await requirePermission(req, res, 'suppliers.edit');
        if (!actor) return;
        try {
            const { рейтинг } = req.body;

            if (!рейтинг || рейтинг < 1 || рейтинг > 5) {
                return res.status(400).json({
                    error: 'Рейтинг должен быть от 1 до 5'
                });
            }

            // Update supplier rating
            const result = await query(
                'UPDATE "Поставщики" SET "рейтинг" = $1 WHERE id = $2',
                [рейтинг, id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            res.status(200).json({
                message: 'Рейтинг поставщика успешно обновлен'
            });
        } catch (error) {
            console.error('Error updating supplier rating:', error);
            res.status(500).json({
                error: 'Ошибка обновления рейтинга: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['POST', 'PATCH', 'DELETE', 'PUT']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}
