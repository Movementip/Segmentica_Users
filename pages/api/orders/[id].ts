import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { calculateVatAmountsFromLine, getVatRateOption } from '../../../lib/vat';
import { normalizeOrderExecutionMode, normalizeOrderSupplyMode, type OrderExecutionMode, type OrderSupplyMode } from '../../../lib/orderModes';

export interface OrderDetail {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    режим_исполнения: OrderExecutionMode;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    сумма_товаров: number;
    сумма_логистики: number;
    адрес_доставки?: string;
    клиент_название?: string;
    клиент_телефон?: string;
    клиент_email?: string;
    клиент_адрес?: string;
    клиент_тип?: string;
    менеджер_фио?: string;
    менеджер_телефон?: string;
    позиции: OrderPosition[];
}

export interface OrderPosition {
    id: number;
    товар_id: number;
    способ_обеспечения: OrderSupplyMode;
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
    res: NextApiResponse<OrderDetail | { error: string }>
) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'orders.view');
        if (!actor) return;
        try {
            // Получаем основную информацию о заявке
            const orderResult = await query(`
        SELECT 
          z.*,
          COALESCE(order_totals.items_total, 0)::numeric as сумма_товаров,
          (
            COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as сумма_логистики,
          (
            COALESCE(order_totals.items_total, 0)
            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as общая_сумма,
          k."название" as клиент_название,
          k."телефон" as клиент_телефон,
          k."email" as клиент_email,
          k."адрес" as клиент_адрес,
          k."тип" as клиент_тип,
          s."фио" as менеджер_фио,
          s."телефон" as менеджер_телефон
        FROM "Заявки" z
        LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
        LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
        LEFT JOIN (
          SELECT
            positions."заявка_id",
            SUM(
              COALESCE(positions."количество", 0)
              * COALESCE(positions."цена", 0)
              * (1 + COALESCE(vat."ставка", 0) / 100.0)
            )::numeric as items_total
          FROM "Позиции_заявки" positions
          LEFT JOIN "Ставки_НДС" vat ON vat.id = positions."ндс_id"
          GROUP BY positions."заявка_id"
        ) order_totals ON order_totals."заявка_id" = z.id
        LEFT JOIN (
          SELECT
            purchases."заявка_id",
            SUM(
              CASE
                WHEN COALESCE(purchases."использовать_доставку", false)
                  AND COALESCE(purchases."статус", 'заказано') <> 'отменено'
                  THEN COALESCE(purchases."стоимость_доставки", 0)
                ELSE 0
              END
            )::numeric as purchase_delivery_total
          FROM "Закупки" purchases
          GROUP BY purchases."заявка_id"
        ) purchase_logistics ON purchase_logistics."заявка_id" = z.id
        LEFT JOIN (
          SELECT
            shipments."заявка_id",
            SUM(
              CASE
                WHEN COALESCE(shipments."использовать_доставку", true)
                  AND COALESCE(shipments."статус", 'в пути') <> 'отменено'
                  THEN COALESCE(shipments."стоимость_доставки", 0)
                ELSE 0
              END
            )::numeric as shipment_delivery_total
          FROM "Отгрузки" shipments
          GROUP BY shipments."заявка_id"
        ) shipment_logistics ON shipment_logistics."заявка_id" = z.id
        WHERE z.id = $1
      `, [id]);

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }

            const order = orderResult.rows[0];

            // Получаем позиции заявки
            const positionsResult = await query(`
                SELECT 
          пз.*,
          пз."количество" * пз."цена" as сумма,
          COALESCE(пз."способ_обеспечения", 'auto') as способ_обеспечения,
          ндс.id as ндс_id,
          ндс."название" as ндс_название,
          ндс."ставка" as ндс_ставка,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица_измерения
        FROM "Позиции_заявки" пз
        LEFT JOIN "Товары" т ON пз."товар_id" = т.id
        LEFT JOIN "Ставки_НДС" ндс ON пз."ндс_id" = ндс.id
        WHERE пз."заявка_id" = $1
        ORDER BY пз.id
      `, [id]);

            const positions: OrderPosition[] = positionsResult.rows.map((row: any) => {
                const hasVatRate = row.ндс_id != null;
                const vatOption = hasVatRate ? getVatRateOption(row.ндс_id) : null;
                const quantity = Number(row.количество) || 0;
                const price = parseFloat(row.цена) || 0;
                const vatRate = hasVatRate ? Number(row.ндс_ставка ?? vatOption?.rate ?? 0) : 0;
                const breakdown = calculateVatAmountsFromLine(quantity, price, vatRate);

                return {
                    id: row.id,
                    товар_id: row.товар_id,
                    способ_обеспечения: normalizeOrderSupplyMode(row.способ_обеспечения, order.режим_исполнения),
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

            const orderDetail: OrderDetail = {
                id: order.id,
                клиент_id: order.клиент_id,
                менеджер_id: order.менеджер_id,
                режим_исполнения: normalizeOrderExecutionMode(order.режим_исполнения),
                дата_создания: order.дата_создания,
                дата_выполнения: order.дата_выполнения,
                статус: order.статус,
                общая_сумма: parseFloat(order.общая_сумма) || 0,
                сумма_товаров: parseFloat(order.сумма_товаров) || 0,
                сумма_логистики: parseFloat(order.сумма_логистики) || 0,
                адрес_доставки: order.адрес_доставки,
                клиент_название: order.клиент_название,
                клиент_телефон: order.клиент_телефон,
                клиент_email: order.клиент_email,
                клиент_адрес: order.клиент_адрес,
                клиент_тип: order.клиент_тип,
                менеджер_фио: order.менеджер_фио,
                менеджер_телефон: order.менеджер_телефон,
                позиции: positions
            };

            res.status(200).json(orderDetail);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения детальной информации о заявке: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}
