import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../lib/db';
import { requirePermission } from '../../lib/auth';
import { getOrderWorkflowSummary, syncOrderWorkflowStatus } from '../../lib/orderWorkflow';
import { getNextShipmentBranchMeta, getRemainingShipmentDraft, normalizeFulfillmentStatus } from '../../lib/orderFulfillment';

interface Shipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string;
    дата_отгрузки: string;
    стоимость_доставки: number;
    заявка_номер?: string;
    транспорт_название?: string;
    branch_no?: number;
    shipment_kind?: string;
}

const normalizeShipmentStatus = (value?: string | null) => normalizeFulfillmentStatus(value);

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, 'shipments.list');
        if (!actor) return;
        try {
            const result = await query(`
                SELECT
                    shipments.*,
                    transports."название" as транспорт_название
                FROM "Отгрузки" shipments
                LEFT JOIN "Транспортные_компании" transports ON shipments."транспорт_id" = transports.id
                ORDER BY COALESCE(shipments.branch_no, 1) DESC, shipments."дата_отгрузки" DESC
            `);

            res.status(200).json(result.rows);
        } catch (error) {
            console.error('Error fetching shipments:', error);
            res.status(500).json({ error: 'Failed to fetch shipments: ' + (error instanceof Error ? error.message : 'Unknown error') });
        }
        return;
    }

    if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'shipments.create');
        if (!actor) return;
        try {
            const { заявка_id, транспорт_id, статус, номер_отслеживания, стоимость_доставки } = req.body;

            if (!заявка_id || !транспорт_id) {
                return res.status(400).json({ error: 'Заявка и транспорт обязательны' });
            }

            const orderCheck = await query(
                'SELECT id FROM "Заявки" WHERE id = $1',
                [заявка_id]
            );

            if (orderCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Заявка не найдена' });
            }

            const transportCheck = await query(
                'SELECT id FROM "Транспортные_компании" WHERE id = $1',
                [транспорт_id]
            );

            if (transportCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Транспортная компания не найдена' });
            }

            const workflow = await getOrderWorkflowSummary(Number(заявка_id));
            if (!workflow.canCreateShipment && normalizeShipmentStatus(статус || 'в пути') !== 'отменено') {
                return res.status(400).json({
                    error: 'Отгрузку можно создать только после сборки заявки и при отсутствии активной отгрузки'
                });
            }

            const pool = await getPool();
            const client = await pool.connect();

            let created: any;
            try {
                await client.query('BEGIN');

                const draftPositions = await getRemainingShipmentDraft(client, Number(заявка_id));
                if (draftPositions.length === 0 && normalizeShipmentStatus(статус || 'в пути') !== 'отменено') {
                    throw new Error('По заявке нет собранных позиций, готовых к отгрузке');
                }

                const branchMeta = await getNextShipmentBranchMeta(client, Number(заявка_id));
                const result = await client.query(
                    `
                        INSERT INTO "Отгрузки" (
                            "заявка_id",
                            "транспорт_id",
                            "статус",
                            "номер_отслеживания",
                            "стоимость_доставки",
                            branch_no,
                            shipment_kind
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING *
                    `,
                    [
                        заявка_id,
                        транспорт_id,
                        статус || 'в пути',
                        номер_отслеживания || null,
                        стоимость_доставки || null,
                        branchMeta.branchNo,
                        branchMeta.shipmentKind,
                    ]
                );

                created = result.rows[0];

                for (const position of draftPositions) {
                    await client.query(
                        `
                            INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
                            VALUES ($1, $2, $3, $4, $5)
                        `,
                        [created.id, position.товар_id, position.количество, position.цена, position.ндс_id]
                    );
                }

                await client.query('COMMIT');
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }

            await syncOrderWorkflowStatus(Number(заявка_id));
            res.status(201).json(created);
        } catch (error) {
            console.error('Error adding shipment:', error);
            res.status(500).json({
                error: 'Ошибка добавления отгрузки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
        return;
    }

    if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'shipments.edit');
        if (!actor) return;
        try {
            const { id, заявка_id, транспорт_id, статус, номер_отслеживания, стоимость_доставки } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'ID обязателен' });
            }

            const existingShipmentResult = await query(
                'SELECT * FROM "Отгрузки" WHERE id = $1 LIMIT 1',
                [id]
            );

            if (existingShipmentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Отгрузка не найдена' });
            }

            const existingShipment = existingShipmentResult.rows[0];
            const previousOrderId = Number(existingShipment.заявка_id);
            const nextOrderId = заявка_id !== undefined ? Number(заявка_id) : previousOrderId;
            const previousStatus = normalizeShipmentStatus(existingShipment.статус);
            const nextStatus = normalizeShipmentStatus(статус ?? existingShipment.статус);
            const wasCancelled = previousStatus === 'отменено';
            const willBeCancelled = nextStatus === 'отменено';

            if (заявка_id !== undefined) {
                const orderCheck = await query(
                    'SELECT id FROM "Заявки" WHERE id = $1',
                    [заявка_id]
                );
                if (orderCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Заявка не найдена' });
                }
            }

            if (транспорт_id !== undefined) {
                const transportCheck = await query(
                    'SELECT id FROM "Транспортные_компании" WHERE id = $1',
                    [транспорт_id]
                );
                if (transportCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Транспортная компания не найдена' });
                }
            }

            if (!willBeCancelled) {
                const workflow = await getOrderWorkflowSummary(nextOrderId);
                const orderChanged = nextOrderId !== previousOrderId;
                const hasAnotherActiveShipment = await query(
                    `
                        SELECT id
                        FROM "Отгрузки"
                        WHERE "заявка_id" = $1
                          AND id <> $2
                          AND COALESCE("статус", 'в пути') NOT IN ('доставлено', 'отменено')
                        LIMIT 1
                    `,
                    [nextOrderId, id]
                );

                if ((orderChanged || wasCancelled) && !workflow.canCreateShipment) {
                    return res.status(400).json({
                        error: 'Эта заявка пока не готова к отгрузке'
                    });
                }

                if (hasAnotherActiveShipment.rows.length > 0) {
                    return res.status(400).json({ error: 'По этой заявке уже есть активная отгрузка' });
                }
            }

            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (заявка_id !== undefined) {
                updateFields.push(`"заявка_id" = $${paramCount}`);
                values.push(заявка_id);
                paramCount++;
            }

            if (транспорт_id !== undefined) {
                updateFields.push(`"транспорт_id" = $${paramCount}`);
                values.push(транспорт_id);
                paramCount++;
            }

            if (статус !== undefined) {
                updateFields.push(`"статус" = $${paramCount}`);
                values.push(статус);
                paramCount++;
            }

            if (номер_отслеживания !== undefined) {
                updateFields.push(`"номер_отслеживания" = $${paramCount}`);
                values.push(номер_отслеживания);
                paramCount++;
            }

            if (стоимость_доставки !== undefined) {
                updateFields.push(`"стоимость_доставки" = $${paramCount}`);
                values.push(стоимость_доставки);
                paramCount++;
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            values.push(id);

            const pool = await getPool();
            const client = await pool.connect();

            let updatedShipment: any;
            try {
                await client.query('BEGIN');

                const result = await client.query(
                    `
                        UPDATE "Отгрузки"
                        SET ${updateFields.join(', ')}
                        WHERE id = $${paramCount}
                        RETURNING *
                    `,
                    values
                );

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Отгрузка не найдена' });
                }

                updatedShipment = result.rows[0];

                if (заявка_id !== undefined && Number(заявка_id) !== previousOrderId) {
                    const draftPositions = willBeCancelled ? [] : await getRemainingShipmentDraft(client, Number(заявка_id));
                    await client.query('DELETE FROM public.shipment_positions WHERE shipment_id = $1', [id]);

                    for (const position of draftPositions) {
                        await client.query(
                            `
                                INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
                                VALUES ($1, $2, $3, $4, $5)
                            `,
                            [id, position.товар_id, position.количество, position.цена, position.ндс_id]
                        );
                    }
                }

                await client.query('COMMIT');
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }

            const orderIdsToSync = [previousOrderId, nextOrderId].filter(
                (value, index, array): value is number => value != null && array.indexOf(value) === index
            );
            for (let index = 0; index < orderIdsToSync.length; index += 1) {
                await syncOrderWorkflowStatus(orderIdsToSync[index]);
            }

            res.status(200).json(updatedShipment);
        } catch (error) {
            console.error('Error updating shipment:', error);
            res.status(500).json({
                error: 'Ошибка обновления отгрузки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
        return;
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'shipments.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'ID обязателен' });
            }

            const shipmentResult = await query(
                'SELECT * FROM "Отгрузки" WHERE id = $1 LIMIT 1',
                [id]
            );

            if (shipmentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Отгрузка не найдена' });
            }

            const shipment = shipmentResult.rows[0];
            const orderId = Number(shipment.заявка_id);

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM "Отгрузки" WHERE id = $1 RETURNING *', [id]);
                await client.query('COMMIT');
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }

            await syncOrderWorkflowStatus(orderId);

            res.status(200).json({ message: 'Shipment deleted successfully' });
        } catch (error) {
            console.error('Error deleting shipment:', error);
            res.status(500).json({ error: 'Failed to delete shipment' });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
}
