import type { NextApiRequest, NextApiResponse } from 'next';
import { requirePermission } from '../../../../lib/auth';
import { getPool, query } from '../../../../lib/db';
import { getOrderWorkflowSummary, syncOrderWorkflowStatus } from '../../../../lib/orderWorkflow';
import { getNextAssemblyBranchMeta } from '../../../../lib/orderFulfillment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }

    const actor = await requirePermission(req, res, 'orders.edit');
    if (!actor) return;

    const { id } = req.query;
    const orderId = Number(id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID заявки' });
    }

    try {
        const workflow = await getOrderWorkflowSummary(orderId);

        if (!workflow.canAssemble) {
            return res.status(400).json({
                error: 'Заявка пока не готова к сборке: по ней еще есть недостачи, незавершенные закупки или не хватает товара на складе'
            });
        }

        const pool = await getPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const batchMeta = await getNextAssemblyBranchMeta(client, orderId);
            const batchResult = await client.query(
                `
                    INSERT INTO public.order_assembly_batches (order_id, branch_no, batch_type, notes)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `,
                [orderId, batchMeta.branchNo, batchMeta.batchType, `${batchMeta.batchType} заявки #${orderId}`]
            );

            const batchId = Number(batchResult.rows[0]?.id);
            const useWarehouse = workflow.executionMode !== 'direct';
            for (const position of workflow.positions) {
                const remainingToTake = Math.max(0, Number(position.осталось_собрать) || 0);
                if (remainingToTake <= 0) continue;

                if (useWarehouse) {
                    const warehouseResult = await client.query(
                        'SELECT COALESCE("количество", 0)::numeric AS количество FROM "Склад" WHERE "товар_id" = $1 LIMIT 1',
                        [position.товар_id]
                    );

                    const currentStock = Number(warehouseResult.rows[0]?.количество) || 0;
                    if (currentStock < remainingToTake) {
                        throw new Error(`Недостаточно товара на складе для сборки: ${position.товар_название}`);
                    }
                }

                await client.query(
                    `
                        INSERT INTO public.order_assembly_batch_positions (batch_id, product_id, quantity)
                        VALUES ($1, $2, $3)
                    `,
                    [batchId, position.товар_id, remainingToTake]
                );

                if (useWarehouse) {
                    await client.query(
                        `
                            UPDATE "Склад"
                            SET "количество" = "количество" - $1
                            WHERE "товар_id" = $2
                        `,
                        [remainingToTake, position.товар_id]
                    );

                    await client.query(
                        `
                            INSERT INTO "Движения_склада" (
                                "товар_id",
                                "тип_операции",
                                "количество",
                                "дата_операции",
                                "заявка_id",
                                "комментарий"
                            ) VALUES ($1, 'расход', $2, CURRENT_TIMESTAMP, $3, $4)
                        `,
                        [position.товар_id, remainingToTake, orderId, `${batchMeta.batchType} заявки #${orderId} (волна ${batchMeta.branchNo})`]
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

        const summary = await syncOrderWorkflowStatus(orderId);
        return res.status(200).json(summary);
    } catch (error) {
        console.error('Error assembling order:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Ошибка сборки заявки'
        });
    }
}
