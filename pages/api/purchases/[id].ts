import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../../lib/vat';
import { syncOrderWorkflowStatus } from '../../../lib/orderWorkflow';
import { checkAndCreateMissingProducts, syncMissingProductsFromPurchases } from '../../../lib/missingProductsHelper';
import { normalizeOrderExecutionMode } from '../../../lib/orderModes';
import { ensureLogisticsDeliverySchema } from '../../../lib/logisticsDelivery';
import { syncPurchaseWarehouseState } from '../../../lib/purchaseWarehouse';

export interface PurchaseDetail {
    id: number;
    поставщик_id: number;
    заявка_id?: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
    использовать_доставку?: boolean;
    транспорт_id?: number | null;
    стоимость_доставки?: number | null;
    транспорт_название?: string;
    поставщик_название: string;
    поставщик_телефон?: string;
    поставщик_email?: string;
    заявка_клиент?: string;
    позиции: PurchasePosition[];
}

export interface PurchasePosition {
    id: number;
    товар_id: number;
    количество: number;
    цена: number;
    сумма: number;
    ндс_id: number | null;
    ндс_название: string;
    ндс_ставка: number;
    сумма_без_ндс: number;
    сумма_ндс: number;
    сумма_всего: number;
    товар_название: string;
    товар_артикул: string;
    товар_категория?: string;
    товар_единица_измерения: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PurchaseDetail | { error: string } | { message: string }>
) {
    const { id } = req.query;
    await ensureLogisticsDeliverySchema();

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'purchases.view');
        if (!actor) return;
        try {
            // Получаем основную информацию о закупке
            const purchaseResult = await query(`
        SELECT 
          з.*,
          (
            COALESCE(totals.total_amount, 0)
            + CASE
              WHEN COALESCE(з."использовать_доставку", false)
                THEN COALESCE(з."стоимость_доставки", 0)
              ELSE 0
            END
          )::numeric as "общая_сумма",
          п."название" as поставщик_название,
          п."телефон" as поставщик_телефон,
          п."email" as поставщик_email,
          к."название" as заявка_клиент,
          тк."название" as транспорт_название
        FROM "Закупки" з
        LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
        LEFT JOIN "Заявки" заяв ON з."заявка_id" = заяв.id
        LEFT JOIN "Клиенты" к ON заяв."клиент_id" = к.id
        LEFT JOIN "Транспортные_компании" тк ON з."транспорт_id" = тк.id
        LEFT JOIN (
          SELECT
            пз."закупка_id",
            SUM(
              COALESCE(пз."количество", 0) * COALESCE(пз."цена", 0) * (1 + COALESCE(ндс."ставка", 0) / 100.0)
            )::numeric as total_amount
          FROM "Позиции_закупки" пз
          LEFT JOIN "Ставки_НДС" ндс ON ндс.id = пз."ндс_id"
          GROUP BY пз."закупка_id"
        ) totals ON totals."закупка_id" = з.id
        WHERE з.id = $1
      `, [id]);

            if (purchaseResult.rows.length === 0) {
                return res.status(404).json({ error: 'Закупка не найдена' });
            }

            const purchase = purchaseResult.rows[0];

            // Получаем позиции закупки
            const positionsResult = await query(`
        SELECT 
          пз.*,
          пз."количество" * пз."цена" as сумма,
          ндс.id as ндс_id,
          ндс."название" as ндс_название,
          ндс."ставка" as ндс_ставка,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица_измерения
        FROM "Позиции_закупки" пз
        LEFT JOIN "Товары" т ON пз."товар_id" = т.id
        LEFT JOIN "Ставки_НДС" ндс ON пз."ндс_id" = ндс.id
        WHERE пз."закупка_id" = $1
        ORDER BY пз.id
      `, [id]);

            const positions: PurchasePosition[] = positionsResult.rows.map((row: any) => {
                const hasVatRate = row.ндс_id != null;
                const vatOption = hasVatRate ? getVatRateOption(row.ндс_id) : null;
                const quantity = Number(row.количество) || 0;
                const price = parseFloat(row.цена) || 0;
                const vatRate = hasVatRate ? Number(row.ндс_ставка ?? vatOption?.rate ?? 0) : 0;
                const breakdown = calculateVatAmountsFromLine(quantity, price, vatRate);

                return {
                    id: row.id,
                    товар_id: row.товар_id,
                    количество: quantity,
                    цена: price,
                    сумма: breakdown.total,
                    ндс_id: hasVatRate ? Number(row.ндс_id) : null,
                    ндс_название: row.ндс_название || 'НДС не задан',
                    ндс_ставка: vatRate,
                    сумма_без_ндс: breakdown.net,
                    сумма_ндс: breakdown.tax,
                    сумма_всего: breakdown.total,
                    товар_название: row.товар_название,
                    товар_артикул: row.товар_артикул,
                    товар_категория: row.товар_категория,
                    товар_единица_измерения: row.товар_единица_измерения || 'шт'
                };
            });

            const purchaseDetail: PurchaseDetail = {
                id: purchase.id,
                поставщик_id: purchase.поставщик_id,
                заявка_id: purchase.заявка_id,
                дата_заказа: purchase.дата_заказа,
                дата_поступления: purchase.дата_поступления,
                статус: purchase.статус,
                общая_сумма: parseFloat(purchase.общая_сумма) || 0,
                использовать_доставку: Boolean(purchase.использовать_доставку),
                транспорт_id: purchase.транспорт_id == null ? null : Number(purchase.транспорт_id),
                стоимость_доставки: purchase.стоимость_доставки == null ? null : Number(purchase.стоимость_доставки),
                транспорт_название: purchase.транспорт_название || undefined,
                поставщик_название: purchase.поставщик_название,
                поставщик_телефон: purchase.поставщик_телефон,
                поставщик_email: purchase.поставщик_email,
                заявка_клиент: purchase.заявка_клиент,
                позиции: positions
            };

            res.status(200).json(purchaseDetail);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения детальной информации о закупке: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'PUT') {
        // Update purchase status
        const actor = await requirePermission(req, res, 'purchases.edit');
        if (!actor) return;
        try {
            const { статус, дата_поступления } = req.body;

            if (!статус) {
                return res.status(400).json({ error: 'Статус обязателен' });
            }

            // Validate status
            const validStatuses = ['заказано', 'в пути', 'получено', 'отменено'];
            if (!validStatuses.includes(статус.toLowerCase())) {
                return res.status(400).json({
                    error: 'Недопустимый статус. Допустимые значения: ' + validStatuses.join(', ')
                });
            }

            // Check if purchase exists
            const purchaseCheck = await query(
                'SELECT * FROM "Закупки" WHERE id = $1',
                [id]
            );

            if (purchaseCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Закупка не найдена' });
            }

            const existingPurchase = purchaseCheck.rows[0];
            const willBeReceived = статус === 'получено';
            let orderExecutionMode = 'warehouse';

            if (existingPurchase.заявка_id != null) {
                const orderModeResult = await query(
                    'SELECT "режим_исполнения" FROM "Заявки" WHERE id = $1 LIMIT 1',
                    [existingPurchase.заявка_id]
                );
                orderExecutionMode = normalizeOrderExecutionMode(orderModeResult.rows[0]?.режим_исполнения);
            }

            // Start transaction
            await query('BEGIN');

            try {
                // Update purchase status
                const updateData: any[] = [статус, id];
                let updateQuery = 'UPDATE "Закупки" SET "статус" = $1';

                if (дата_поступления) {
                    updateQuery += ', "дата_поступления" = $3';
                    updateData.splice(1, 0, дата_поступления);
                } else if (willBeReceived && !existingPurchase.дата_поступления) {
                    updateQuery += ', "дата_поступления" = CURRENT_TIMESTAMP';
                }

                updateQuery += ' WHERE id = $' + updateData.length;

                await query(updateQuery, updateData);

                await syncPurchaseWarehouseState(
                    { query },
                    Number(id),
                    orderExecutionMode !== 'direct' && willBeReceived
                );

                // Commit transaction
                await query('COMMIT');

            if (existingPurchase.заявка_id) {
                await checkAndCreateMissingProducts(Number(existingPurchase.заявка_id));
                await syncMissingProductsFromPurchases(Number(existingPurchase.заявка_id));
                await syncOrderWorkflowStatus(Number(existingPurchase.заявка_id));
            }

                res.status(200).json({ message: 'Статус закупки успешно обновлен' });
            } catch (transactionError) {
                // Rollback transaction on error
                await query('ROLLBACK');
                throw transactionError;
            }
        } catch (error) {
            console.error('Error updating purchase:', error);
            res.status(500).json({
                error: 'Ошибка обновления закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}
