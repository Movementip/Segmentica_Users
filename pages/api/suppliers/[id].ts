import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requireAuth, requirePermission } from '../../../lib/auth';

export interface SupplierDetail {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг: number;
    created_at: string;
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

            const supplierDetail: SupplierDetail = {
                id: supplier.id,
                название: supplier.название,
                телефон: supplier.телефон,
                email: supplier.email,
                рейтинг: supplier.рейтинг,
                created_at: supplier.created_at,
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
            const { название, телефон, email, рейтинг } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'ID поставщика обязателен' });
            }

            if (!название) {
                return res.status(400).json({ error: 'Название поставщика обязательно' });
            }

            const check = await query('SELECT id FROM "Поставщики" WHERE id = $1', [id]);
            if (check.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }

            await query(
                'UPDATE "Поставщики" SET "название" = $1, "телефон" = $2, "email" = $3, "рейтинг" = $4 WHERE id = $5',
                [название, телефон || null, email || null, рейтинг || 5, id]
            );

            const updated = await query('SELECT * FROM "Поставщики" WHERE id = $1', [id]);
            res.status(200).json(updated.rows[0] as any);
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