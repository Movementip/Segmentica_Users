import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../lib/db';
import { hasPermission, requireAuth, requirePermission } from '../../lib/auth';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption, isValidVatRateId, normalizeVatRateId } from '../../lib/vat';
import { getOrderWorkflowSummary, syncOrderWorkflowStatus } from '../../lib/orderWorkflow';
import { checkAndCreateMissingProducts } from '../../lib/missingProductsHelper';
import { reconcileOrderExecutionsForPositionUpdate, rollbackOrderFulfillment } from '../../lib/orderFulfillment';

const calculateOrderTotal = (positions: Array<{ количество: number; цена: number; ндс_id?: number }>) => (
    positions.reduce((sum, item) => {
        const vatRate = getVatRateOption(item?.ндс_id ?? DEFAULT_VAT_RATE_ID).rate;
        return sum + calculateVatAmountsFromLine(Number(item?.количество), Number(item?.цена), vatRate).total;
    }, 0)
);

export interface Order {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    клиент_название?: string;
    менеджер_фио?: string;
    can_create_purchase?: boolean;
    can_assemble?: boolean;
    can_create_shipment?: boolean;
    can_complete?: boolean;
    next_assembly_label?: string | null;
    next_shipment_label?: string | null;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Order[] | Order | { error: string } | { message: string; deletedOrder?: Order } | { error: string; purchases: any[]; movementsCount: number }>
) {
    if (req.method === 'GET') {
        try {
            const { client_id } = req.query;
            if (client_id) {
                const actor = await requireAuth(req, res);
                if (!actor) return;

                const allowed = hasPermission(actor, 'orders.list') || hasPermission(actor, 'clients.orders_history.view');
                if (!allowed) {
                    res.status(403).json({ error: 'Forbidden' });
                    return;
                }

                const result = await query(`
          SELECT 
            z.*,
            k."название" as клиент_название,
            s."фио" as менеджер_фио
          FROM "Заявки" z
          LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
          LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
          WHERE z."клиент_id" = $1
          ORDER BY z."дата_создания" DESC
        `, [client_id]);

                const baseOrders: Order[] = result.rows.map((row: any) => ({
                    id: row.id,
                    клиент_id: row.клиент_id,
                    менеджер_id: row.менеджер_id,
                    дата_создания: row.дата_создания,
                    дата_выполнения: row.дата_выполнения,
                    статус: row.статус,
                    общая_сумма: parseFloat(row.общая_сумма) || 0,
                    адрес_доставки: row.адрес_доставки,
                    клиент_название: row.клиент_название,
                    менеджер_фио: row.менеджер_фио
                }));

                const orders = await Promise.all(baseOrders.map(async (order) => {
                    const summary = await syncOrderWorkflowStatus(Number(order.id));
                    return {
                        ...order,
                        статус: summary.currentStatus,
                        can_create_purchase: summary.canCreatePurchase,
                        can_assemble: summary.canAssemble,
                        can_create_shipment: summary.canCreateShipment,
                        can_complete: summary.canComplete,
                        next_assembly_label: summary.nextAssemblyActionLabel,
                        next_shipment_label: summary.nextShipmentActionLabel,
                    };
                }));

                res.status(200).json(orders);
                return;
            }

            const actor = await requirePermission(req, res, 'orders.list');
            if (!actor) return;

            const result = await query(`
        SELECT 
          z.*,
          k."название" as клиент_название,
          s."фио" as менеджер_фио
        FROM "Заявки" z
        LEFT JOIN "Клиенты" k ON z."клиент_id" = k.id
        LEFT JOIN "Сотрудники" s ON z."менеджер_id" = s.id
        ORDER BY z."дата_создания" DESC 
        LIMIT 50
      `);

            const baseOrders: Order[] = result.rows.map((row: any) => ({
                id: row.id,
                клиент_id: row.клиент_id,
                менеджер_id: row.менеджер_id,
                дата_создания: row.дата_создания,
                дата_выполнения: row.дата_выполнения,
                статус: row.статус,
                общая_сумма: parseFloat(row.общая_сумма) || 0,
                адрес_доставки: row.адрес_доставки,
                клиент_название: row.клиент_название,
                менеджер_фио: row.менеджер_фио
            }));

            const orders = await Promise.all(baseOrders.map(async (order) => {
                const summary = await syncOrderWorkflowStatus(Number(order.id));
                return {
                    ...order,
                    статус: summary.currentStatus,
                    can_create_purchase: summary.canCreatePurchase,
                    can_assemble: summary.canAssemble,
                    can_create_shipment: summary.canCreateShipment,
                    can_complete: summary.canComplete,
                    next_assembly_label: summary.nextAssemblyActionLabel,
                    next_shipment_label: summary.nextShipmentActionLabel,
                };
            }));

            res.status(200).json(orders);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                error: 'Ошибка получения заявок из базы данных: ' + (error instanceof Error ? error.message : 'Unknown error')
            });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'orders.create');
        if (!actor) return;
        try {
            const {
                клиент_id,
                менеджер_id,
                адрес_доставки,
                позиции
            } = req.body;
            if (!клиент_id || !позиции || позиции.length === 0) {
                return res.status(400).json({ error: 'Клиент и позиции заявки обязательны' });
            }
            const общая_сумма = calculateOrderTotal(позиции);

            for (const позиция of позиции) {
                if (!isValidVatRateId(позиция?.ндс_id ?? DEFAULT_VAT_RATE_ID)) {
                    return res.status(400).json({ error: 'Некорректная ставка НДС в одной из позиций' });
                }
            }

            const orderResult = await query(`
        INSERT INTO "Заявки" (
          "клиент_id", 
          "менеджер_id", 
          "адрес_доставки", 
          "общая_сумма", 
          "статус"
        ) VALUES ($1, $2, $3, $4, 'новая')
        RETURNING *
      `, [клиент_id, менеджер_id || null, адрес_доставки || null, общая_сумма]);

            const newOrder = orderResult.rows[0];

            for (const позиция of позиции) {
                await query(`
          INSERT INTO "Позиции_заявки" (
            "заявка_id", 
            "товар_id", 
            "количество", 
            "цена",
            "ндс_id"
          ) VALUES ($1, $2, $3, $4, $5)
        `, [newOrder.id, позиция.товар_id, позиция.количество, позиция.цена, normalizeVatRateId(позиция.ндс_id)]);
            }

            await checkAndCreateMissingProducts(Number(newOrder.id));

            res.status(201).json(newOrder);
        } catch (error) {
            console.error('Error creating order:', error);

            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: 'Failed to create order' });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'orders.edit');
        if (!actor) return;
        try {
            const { id, клиент_id, менеджер_id, адрес_доставки, статус, позиции } = req.body;
            const normalizedStatus = typeof статус === 'string' ? статус.trim() : статус;
            const shouldUpdatePositions = Array.isArray(позиции);

            if (!shouldUpdatePositions && normalizedStatus !== undefined && normalizedStatus !== '') {
                const missingBeforeStatusUpdate = await query(`
          SELECT id, "товар_id", "необходимое_количество", "недостающее_количество", "статус"
          FROM "Недостающие_товары"
          WHERE "заявка_id" = $1
          ORDER BY id
        `, [id]);

                console.log('Order status-only update missing products BEFORE:', {
                    orderId: id,
                    newStatus: normalizedStatus,
                    missingProducts: missingBeforeStatusUpdate.rows,
                });
            }

            console.log('Updating order with data:', {
                id,
                клиент_id,
                менеджер_id,
                адрес_доставки,
                статус: normalizedStatus,
                позиции
            });

            if (!id || !клиент_id) {
                return res.status(400).json({ error: 'ID заявки и клиент обязательны' });
            }

            if (shouldUpdatePositions && позиции.length === 0) {
                return res.status(400).json({ error: 'Заявка должна содержать хотя бы одну позицию' });
            }

            if (shouldUpdatePositions) {
                for (const позиция of позиции) {
                    const productId = Number(позиция?.товар_id);
                    const quantity = Number(позиция?.количество);
                    const price = Number(позиция?.цена);
                    const vatRateId = позиция?.ндс_id ?? DEFAULT_VAT_RATE_ID;

                    if (!Number.isInteger(productId) || productId <= 0) {
                        return res.status(400).json({ error: 'Некорректный товар в позициях заявки' });
                    }

                    if (!Number.isFinite(quantity) || quantity <= 0) {
                        return res.status(400).json({ error: 'Количество в позиции должно быть больше 0' });
                    }

                    if (!Number.isFinite(price) || price <= 0) {
                        return res.status(400).json({ error: 'Цена в позиции должна быть больше 0' });
                    }

                    if (!isValidVatRateId(vatRateId)) {
                        return res.status(400).json({ error: 'Некорректная ставка НДС в позициях заявки' });
                    }
                }
            }

            if (!shouldUpdatePositions && normalizedStatus && ['собрана', 'отгружена', 'выполнена'].includes(normalizedStatus)) {
                const workflow = await getOrderWorkflowSummary(Number(id));

                if (normalizedStatus === 'собрана' && !workflow.isAssembled) {
                    return res.status(400).json({
                        error: 'Статус «Собрана» появляется только после отдельного действия «Собрать заявку»'
                    });
                }

                if (normalizedStatus === 'отгружена' && workflow.activeShipmentCount === 0 && workflow.deliveredShipmentCount === 0) {
                    return res.status(400).json({
                        error: 'Нельзя перевести заявку в статус «Отгружена», пока по ней нет созданной отгрузки'
                    });
                }

                if (normalizedStatus === 'выполнена' && !workflow.canComplete) {
                    return res.status(400).json({
                        error: 'Нельзя завершить заявку, пока по ней нет доставленной отгрузки'
                    });
                }
            }

            if (!shouldUpdatePositions && normalizedStatus && ['собрана', 'отгружена', 'выполнена'].includes(normalizedStatus)) {
                const activeMissingResult = await query(`
                    SELECT COUNT(*)::int AS count
                    FROM "Недостающие_товары"
                    WHERE "заявка_id" = $1
                      AND COALESCE("активна", true) = true
                      AND "недостающее_количество" > 0
                      AND COALESCE("статус", 'в обработке') != 'получено'
                `, [id]);

                const activeMissingCount = activeMissingResult.rows[0]?.count || 0;

                if (activeMissingCount > 0) {
                    return res.status(400).json({
                        error: 'Нельзя перевести заявку в этот статус, пока по ней есть активные недостачи'
                    });
                }
            }

            let общая_сумма;
            if (shouldUpdatePositions && позиции.length > 0) {
                общая_сумма = calculateOrderTotal(позиции);
            }

            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            updateFields.push(`"клиент_id" = $${paramCount}`);
            values.push(клиент_id);
            paramCount++;

            if (менеджер_id !== undefined) {
                updateFields.push(`"менеджер_id" = $${paramCount}`);
                values.push(менеджер_id);
                paramCount++;
            }

            if (адрес_доставки !== undefined) {
                updateFields.push(`"адрес_доставки" = $${paramCount}`);
                values.push(адрес_доставки);
                paramCount++;
            }

            if (normalizedStatus !== undefined && normalizedStatus !== '') {
                updateFields.push(`"статус" = $${paramCount}`);
                values.push(normalizedStatus);
                paramCount++;
            }

            if (общая_сумма !== undefined) {
                updateFields.push(`"общая_сумма" = $${paramCount}`);
                values.push(общая_сумма);
                paramCount++;
            }

            values.push(id);

            console.log('Executing update query:', `UPDATE "Заявки" SET ${updateFields.join(', ')} WHERE id = $${paramCount}`);
            console.log('Query values:', values);

            const pool = await getPool();
            const client = await pool.connect();
            let orderResult;

            try {
                await client.query('BEGIN');

                if (normalizedStatus === 'отменена') {
                    await rollbackOrderFulfillment(client, Number(id), {
                        reason: `Отмена заявки #${id}`,
                        closeMissingProducts: true,
                    });
                }

                if (shouldUpdatePositions) {
                    await reconcileOrderExecutionsForPositionUpdate(client, Number(id), позиции);
                }

                orderResult = await client.query(`
        UPDATE "Заявки" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

                console.log('Update result:', orderResult.rows);

                if (orderResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Заявка не найдена' });
                }

                if (shouldUpdatePositions) {
                    await client.query('DELETE FROM "Позиции_заявки" WHERE "заявка_id" = $1', [id]);

                    for (const позиция of позиции) {
                        await client.query(`
            INSERT INTO "Позиции_заявки" (
              "заявка_id", 
              "товар_id", 
              "количество", 
              "цена",
              "ндс_id"
            ) VALUES ($1, $2, $3, $4, $5)
          `, [id, позиция.товар_id, позиция.количество, позиция.цена, normalizeVatRateId(позиция.ндс_id)]);
                    }
                }

                if (!shouldUpdatePositions && normalizedStatus !== undefined && normalizedStatus !== '') {
                    const missingAfterStatusUpdate = await client.query(`
          SELECT id, "товар_id", "необходимое_количество", "недостающее_количество", "статус"
          FROM "Недостающие_товары"
          WHERE "заявка_id" = $1
          ORDER BY id
        `, [id]);

                    console.log('Order status-only update missing products AFTER:', {
                        orderId: id,
                        newStatus: normalizedStatus,
                        missingProducts: missingAfterStatusUpdate.rows,
                    });
                }

                await client.query('COMMIT');
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }

            if (shouldUpdatePositions) {
                await checkAndCreateMissingProducts(Number(id));
            } else {
                await syncOrderWorkflowStatus(Number(id));
            }

            res.status(200).json(orderResult.rows[0]);
        } catch (error) {
            console.error('Error updating order:', error);

            if (error instanceof Error) {
                if (error.message.includes('constraint') || error.message.includes('Нарушение')) {
                    return res.status(400).json({
                        error: 'Нарушение ограничений базы данных: ' + error.message
                    });
                }

                return res.status(500).json({
                    error: 'Database error: ' + error.message
                });
            }

            res.status(500).json({ error: 'Failed to update order' });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'orders.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID заявки обязателен' });
            }

            const purchasesResult = await query(
                `SELECT id, "статус", "дата_заказа", "общая_сумма" FROM "Закупки" WHERE "заявка_id" = $1 ORDER BY "дата_заказа" DESC`,
                [id]
            );

            const linkedPurchases = purchasesResult.rows ?? [];

            if (linkedPurchases.length > 0) {
                const movementsResult = await query(
                    `SELECT COUNT(*)::int as count FROM "Движения_склада" WHERE "закупка_id" IN (SELECT id FROM "Закупки" WHERE "заявка_id" = $1)`,
                    [id]
                );
                const movementsCount = movementsResult.rows?.[0]?.count ?? 0;

                return res.status(409).json({
                    error: 'Невозможно удалить заявку: есть связанные закупки/движения склада',
                    purchases: linkedPurchases,
                    movementsCount,
                } as any);
            }

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                await rollbackOrderFulfillment(client, Number(id), {
                    reason: `Удаление заявки #${id}`,
                    detachOrderReferences: true,
                    closeMissingProducts: true,
                });

                await client.query('DELETE FROM "Позиции_заявки" WHERE "заявка_id" = $1', [id]);

                const result = await client.query('DELETE FROM "Заявки" WHERE id = $1 RETURNING *', [id]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Заявка не найдена' });
                }

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Заявка успешно удалена', deletedOrder: result.rows[0] });
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error deleting order:', error);

            if (error instanceof Error && (error.message.includes('violates foreign key constraint') || error.message.includes('constraint'))) {
                return res.status(400).json({ error: 'Невозможно удалить заявку: существуют связанные закупки или другие данные. Сначала удалите связанные записи.' });
            }
            res.status(500).json({ error: 'Failed to delete order' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}
