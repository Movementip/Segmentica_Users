import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../lib/db';
import { requirePermission } from '../../lib/auth';
import { getOrderWorkflowSummary, syncOrderWorkflowStatus } from '../../lib/orderWorkflow';
import { getNextShipmentBranchMeta, getRemainingShipmentDraft, normalizeFulfillmentStatus } from '../../lib/orderFulfillment';
import { ensureLogisticsDeliverySchema, normalizeDeliveryCost, toBoolean } from '../../lib/logisticsDelivery';
import { DEFAULT_VAT_RATE_ID, isValidVatRateId, normalizeVatRateId } from '../../lib/vat';
import { syncStandaloneShipmentFinanceRecord } from '../../lib/companyFinance';
import { recalculateShipmentDeliveryCostIfNeeded } from '../../lib/shipmentDeliveryCost';

interface Shipment {
    id: number;
    заявка_id: number | null;
    использовать_доставку?: boolean;
    без_учета_склада?: boolean;
    транспорт_id: number | null;
    статус: string;
    номер_отслеживания: string;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер?: string;
    транспорт_название?: string;
    branch_no?: number;
    shipment_kind?: string;
}

interface ShipmentPositionInput {
    товар_id: number;
    количество: number;
    цена: number;
    ндс_id?: number;
}

const normalizeShipmentStatus = (value?: string | null) => normalizeFulfillmentStatus(value);
const isActiveShipmentStatus = (value?: string | null) => normalizeShipmentStatus(value) !== 'отменено';

const areDirectShipmentPositionsEqual = (left: ShipmentPositionInput[], right: ShipmentPositionInput[]) => {
    if (left.length !== right.length) return false;

    return left.every((position, index) => {
        const candidate = right[index];
        return (
            Number(position.товар_id) === Number(candidate?.товар_id)
            && Number(position.количество) === Number(candidate?.количество)
            && Number(position.цена) === Number(candidate?.цена)
            && normalizeVatRateId(position.ндс_id) === normalizeVatRateId(candidate?.ндс_id)
        );
    });
};

const normalizeDirectShipmentPositions = (positions: unknown): ShipmentPositionInput[] => (
    Array.isArray(positions)
        ? positions
            .map((item) => ({
                товар_id: Number((item as any)?.товар_id) || 0,
                количество: Number((item as any)?.количество) || 0,
                цена: Number((item as any)?.цена) || 0,
                ндс_id: (item as any)?.ндс_id == null ? DEFAULT_VAT_RATE_ID : Number((item as any)?.ндс_id) || DEFAULT_VAT_RATE_ID,
            }))
            .filter((item) => item.товар_id > 0 && item.количество > 0 && item.цена > 0)
        : []
);

const validateDirectShipmentPositions = async (
    client: { query: (text: string, params?: any[]) => Promise<any> },
    positions: ShipmentPositionInput[]
) => {
    for (const position of positions) {
        if (!isValidVatRateId(position.ндс_id ?? DEFAULT_VAT_RATE_ID)) {
            throw new Error('У одной из позиций отгрузки указана некорректная ставка НДС');
        }

        const productResult = await client.query(
            'SELECT id, "название" FROM "Товары" WHERE id = $1 LIMIT 1',
            [position.товар_id]
        );
        if (productResult.rows.length === 0) {
            throw new Error(`Товар с ID ${position.товар_id} не найден`);
        }
    }
};

const ensureDirectShipmentStockAvailable = async (
    client: { query: (text: string, params?: any[]) => Promise<any> },
    positions: ShipmentPositionInput[]
) => {
    for (const position of positions) {
        const stockResult = await client.query(
            'SELECT COALESCE("количество", 0)::numeric AS quantity FROM "Склад" WHERE "товар_id" = $1 LIMIT 1',
            [position.товар_id]
        );
        const stockQuantity = Number(stockResult.rows[0]?.quantity) || 0;
        if (stockQuantity < position.количество) {
            throw new Error(`Недостаточно товара на складе для отгрузки: ID ${position.товар_id}, доступно ${stockQuantity}`);
        }
    }
};

const applyDirectShipmentStockChange = async (
    client: { query: (text: string, params?: any[]) => Promise<any> },
    shipmentId: number,
    positions: ShipmentPositionInput[],
    direction: 'out' | 'back'
) => {
    for (const position of positions) {
        const quantity = Number(position.количество) || 0;
        if (quantity <= 0) continue;

        if (direction === 'out') {
            await client.query(
                'UPDATE "Склад" SET "количество" = "количество" - $1, updated_at = CURRENT_TIMESTAMP WHERE "товар_id" = $2',
                [quantity, position.товар_id]
            );
            await client.query(
                `
                    INSERT INTO "Движения_склада" (
                        "товар_id", "тип_операции", "количество", "дата_операции", "отгрузка_id", "комментарий"
                    ) VALUES ($1, 'расход', $2, CURRENT_TIMESTAMP, $3, $4)
                `,
                [position.товар_id, quantity, shipmentId, `Самостоятельная отгрузка #${shipmentId}`]
            );
        } else {
            await client.query(
                `
                    INSERT INTO "Склад" ("товар_id", "количество")
                    VALUES ($1, $2)
                    ON CONFLICT ("товар_id")
                    DO UPDATE SET
                        "количество" = "Склад"."количество" + EXCLUDED."количество",
                        updated_at = CURRENT_TIMESTAMP
                `,
                [position.товар_id, quantity]
            );
            await client.query(
                `
                    INSERT INTO "Движения_склада" (
                        "товар_id", "тип_операции", "количество", "дата_операции", "отгрузка_id", "комментарий"
                    ) VALUES ($1, 'приход', $2, CURRENT_TIMESTAMP, $3, $4)
                `,
                [position.товар_id, quantity, shipmentId, `Возврат по самостоятельной отгрузке #${shipmentId}`]
            );
        }
    }
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    await ensureLogisticsDeliverySchema();

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
            const { заявка_id, использовать_доставку, без_учета_склада, транспорт_id, статус, номер_отслеживания, стоимость_доставки, позиции } = req.body;
            const normalizedOrderId = заявка_id == null || заявка_id === '' || Number(заявка_id) <= 0 ? null : Number(заявка_id);
            const useDelivery = toBoolean(использовать_доставку, true);
            const withoutStockAccounting = normalizedOrderId == null ? toBoolean(без_учета_склада, false) : false;
            const normalizedTransportId = useDelivery && транспорт_id != null ? Number(транспорт_id) : null;
            const normalizedDeliveryCost = useDelivery ? normalizeDeliveryCost(стоимость_доставки) : null;
            const directPositions = normalizedOrderId == null ? normalizeDirectShipmentPositions(позиции) : [];

            if (useDelivery && (!normalizedTransportId || normalizedTransportId <= 0)) {
                return res.status(400).json({ error: 'При включенной доставке нужно выбрать транспортную компанию' });
            }

            if (normalizedOrderId) {
                const orderCheck = await query(
                    'SELECT id FROM "Заявки" WHERE id = $1',
                    [normalizedOrderId]
                );

                if (orderCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Заявка не найдена' });
                }
            }

            if (normalizedTransportId) {
                const transportCheck = await query(
                    'SELECT id FROM "Транспортные_компании" WHERE id = $1',
                    [normalizedTransportId]
                );

                if (transportCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Транспортная компания не найдена' });
                }
            }

            if (normalizedOrderId) {
                const workflow = await getOrderWorkflowSummary(Number(normalizedOrderId));
                if (!workflow.canCreateShipment && normalizeShipmentStatus(статус || 'в пути') !== 'отменено') {
                    return res.status(400).json({
                        error: 'Отгрузку можно создать только после сборки заявки и при наличии подготовленных, но ещё не отгруженных позиций'
                    });
                }
            }

            const pool = await getPool();
            const client = await pool.connect();

            let created: any;
            try {
                await client.query('BEGIN');

                await validateDirectShipmentPositions(client, directPositions);
                const draftPositions = normalizedOrderId
                    ? await getRemainingShipmentDraft(client, Number(normalizedOrderId))
                    : [];
                if (normalizedOrderId && draftPositions.length === 0 && normalizeShipmentStatus(статус || 'в пути') !== 'отменено') {
                    throw new Error('По заявке нет собранных позиций, готовых к отгрузке');
                }
                if (normalizedOrderId == null && directPositions.length === 0) {
                    throw new Error('Для самостоятельной отгрузки добавьте хотя бы одну позицию');
                }
                if (normalizedOrderId == null && isActiveShipmentStatus(статус || 'в пути') && !withoutStockAccounting) {
                    await ensureDirectShipmentStockAvailable(client, directPositions);
                }

                const branchMeta = normalizedOrderId
                    ? await getNextShipmentBranchMeta(client, Number(normalizedOrderId))
                    : { branchNo: 1, shipmentKind: 'самостоятельная' };
                const result = await client.query(
                    `
                        INSERT INTO "Отгрузки" (
                            "заявка_id",
                            "использовать_доставку",
                            "без_учета_склада",
                            "транспорт_id",
                            "статус",
                            "номер_отслеживания",
                            "стоимость_доставки",
                            branch_no,
                            shipment_kind
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING *
                    `,
                    [
                        normalizedOrderId,
                        useDelivery,
                        withoutStockAccounting,
                        normalizedTransportId,
                        статус || 'в пути',
                        номер_отслеживания || null,
                        normalizedDeliveryCost,
                        branchMeta.branchNo,
                        branchMeta.shipmentKind,
                    ]
                );

                created = result.rows[0];

                const positionsToInsert = normalizedOrderId == null ? directPositions : draftPositions;
                for (const position of positionsToInsert) {
                    await client.query(
                        `
                            INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
                            VALUES ($1, $2, $3, $4, $5)
                        `,
                        [created.id, position.товар_id, position.количество, position.цена, normalizeVatRateId(position.ндс_id)]
                    );
                }

                await recalculateShipmentDeliveryCostIfNeeded(client, Number(created.id));

                if (normalizedOrderId == null && isActiveShipmentStatus(статус || 'в пути') && !withoutStockAccounting) {
                    await applyDirectShipmentStockChange(client, Number(created.id), directPositions, 'out');
                }

                if (normalizedOrderId == null) {
                    await syncStandaloneShipmentFinanceRecord(client, Number(created.id));
                }

                await client.query('COMMIT');
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }

            if (normalizedOrderId) {
                await syncOrderWorkflowStatus(Number(normalizedOrderId));
            }
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
            const { id, заявка_id, использовать_доставку, без_учета_склада, транспорт_id, статус, номер_отслеживания, стоимость_доставки, позиции } = req.body;

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
            const previousOrderId = existingShipment.заявка_id == null ? null : Number(existingShipment.заявка_id);
            const nextOrderId = заявка_id !== undefined
                ? (заявка_id == null || заявка_id === '' || Number(заявка_id) <= 0 ? null : Number(заявка_id))
                : previousOrderId;
            const previousWithoutStockAccounting = toBoolean(existingShipment.без_учета_склада, false);
            const previousStatus = normalizeShipmentStatus(existingShipment.статус);
            const nextStatus = normalizeShipmentStatus(статус ?? existingShipment.статус);
            const wasCancelled = previousStatus === 'отменено';
            const willBeCancelled = nextStatus === 'отменено';
            const positionsProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'позиции');
            const directPositions = nextOrderId == null ? normalizeDirectShipmentPositions(позиции) : [];
            const nextWithoutStockAccounting = nextOrderId == null
                ? (
                    typeof без_учета_склада === 'undefined'
                        ? previousWithoutStockAccounting
                        : toBoolean(без_учета_склада, false)
                )
                : false;

            if ((previousOrderId == null) !== (nextOrderId == null)) {
                return res.status(400).json({
                    error: 'Нельзя менять тип отгрузки между самостоятельной и привязанной к заявке. Создайте новую отгрузку.'
                });
            }

            if (nextOrderId != null && заявка_id !== undefined) {
                const orderCheck = await query(
                    'SELECT id FROM "Заявки" WHERE id = $1',
                    [nextOrderId]
                );
                if (orderCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Заявка не найдена' });
                }
            }

            const useDelivery = typeof использовать_доставку === 'undefined'
                ? undefined
                : toBoolean(использовать_доставку, true);
            const normalizedTransportId = typeof транспорт_id === 'undefined'
                ? undefined
                : транспорт_id == null || транспорт_id === 0
                    ? null
                    : Number(транспорт_id);
            const normalizedDeliveryCost = typeof стоимость_доставки === 'undefined'
                ? undefined
                : normalizeDeliveryCost(стоимость_доставки);
            const effectiveUseDelivery = typeof useDelivery === 'undefined'
                ? toBoolean(existingShipment.использовать_доставку, true)
                : useDelivery;
            const effectiveTransportId = effectiveUseDelivery
                ? (
                    typeof normalizedTransportId === 'undefined'
                        ? (existingShipment.транспорт_id == null ? null : Number(existingShipment.транспорт_id))
                        : normalizedTransportId
                )
                : null;

            if (effectiveUseDelivery && (!effectiveTransportId || effectiveTransportId <= 0)) {
                return res.status(400).json({ error: 'При включенной доставке нужно выбрать транспортную компанию' });
            }

            if (effectiveTransportId) {
                const transportCheck = await query(
                    'SELECT id FROM "Транспортные_компании" WHERE id = $1',
                    [effectiveTransportId]
                );
                if (transportCheck.rows.length === 0) {
                    return res.status(400).json({ error: 'Транспортная компания не найдена' });
                }
            }

            if (!willBeCancelled && nextOrderId != null) {
                const workflow = await getOrderWorkflowSummary(nextOrderId);
                const orderChanged = nextOrderId !== previousOrderId;
                if ((orderChanged || wasCancelled) && !workflow.canCreateShipment) {
                    return res.status(400).json({
                        error: 'Эта заявка пока не готова к отгрузке'
                    });
                }
            }

            const updateFields: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (заявка_id !== undefined) {
                updateFields.push(`"заявка_id" = $${paramCount}`);
                values.push(nextOrderId);
                paramCount++;
            }

            if (typeof useDelivery !== 'undefined') {
                updateFields.push(`"использовать_доставку" = $${paramCount}`);
                values.push(useDelivery);
                paramCount++;
            }

            if (typeof без_учета_склада !== 'undefined' || заявка_id !== undefined) {
                updateFields.push(`"без_учета_склада" = $${paramCount}`);
                values.push(nextWithoutStockAccounting);
                paramCount++;
            }

            if (транспорт_id !== undefined) {
                updateFields.push(`"транспорт_id" = $${paramCount}`);
                values.push(effectiveUseDelivery ? effectiveTransportId : null);
                paramCount++;
            }

            if (typeof useDelivery !== 'undefined' && typeof normalizedTransportId === 'undefined') {
                updateFields.push(`"транспорт_id" = $${paramCount}`);
                values.push(effectiveUseDelivery ? effectiveTransportId : null);
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

            if (typeof normalizedDeliveryCost !== 'undefined') {
                updateFields.push(`"стоимость_доставки" = $${paramCount}`);
                values.push(effectiveUseDelivery ? normalizedDeliveryCost : null);
                paramCount++;
            } else if (typeof useDelivery !== 'undefined') {
                updateFields.push(`"стоимость_доставки" = $${paramCount}`);
                values.push(effectiveUseDelivery ? (existingShipment.стоимость_доставки == null ? null : Number(existingShipment.стоимость_доставки)) : null);
                paramCount++;
            }

            if (updateFields.length === 0 && !(previousOrderId == null && positionsProvided)) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            const pool = await getPool();
            const client = await pool.connect();

            let updatedShipment: any;
            try {
                await client.query('BEGIN');

                if (updateFields.length > 0) {
                    const updateValues = [...values, id];
                    const result = await client.query(
                        `
                            UPDATE "Отгрузки"
                            SET ${updateFields.join(', ')}
                            WHERE id = $${paramCount}
                            RETURNING *
                        `,
                        updateValues
                    );

                    if (result.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(404).json({ error: 'Отгрузка не найдена' });
                    }

                    updatedShipment = result.rows[0];
                } else {
                    updatedShipment = existingShipment;
                }

                if (заявка_id !== undefined && nextOrderId !== previousOrderId) {
                    const draftPositions = willBeCancelled || nextOrderId == null
                        ? []
                        : await getRemainingShipmentDraft(client, Number(nextOrderId));
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

                if (previousOrderId == null) {
                    const currentPositionsResult = await client.query(
                        'SELECT product_id AS "товар_id", quantity AS "количество", price AS "цена", vat_id AS "ндс_id" FROM public.shipment_positions WHERE shipment_id = $1 ORDER BY id',
                        [id]
                    );
                    const currentPositions = normalizeDirectShipmentPositions(currentPositionsResult.rows);
                    const nextDirectPositions = positionsProvided ? directPositions : currentPositions;
                    const positionsChanged = positionsProvided && !areDirectShipmentPositionsEqual(currentPositions, nextDirectPositions);
                    const previousAffectsStock = !wasCancelled && !previousWithoutStockAccounting;
                    const nextAffectsStock = !willBeCancelled && !nextWithoutStockAccounting;

                    if (positionsProvided) {
                        if (nextDirectPositions.length === 0) {
                            throw new Error('Для самостоятельной отгрузки добавьте хотя бы одну позицию');
                        }
                        await validateDirectShipmentPositions(client, nextDirectPositions);
                    }

                    if (positionsChanged || wasCancelled !== willBeCancelled || previousWithoutStockAccounting !== nextWithoutStockAccounting) {
                        if (previousAffectsStock) {
                            await applyDirectShipmentStockChange(client, Number(id), currentPositions, 'back');
                        }

                        if (positionsProvided) {
                            await client.query('DELETE FROM public.shipment_positions WHERE shipment_id = $1', [id]);

                            for (const position of nextDirectPositions) {
                                await client.query(
                                    `
                                        INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
                                        VALUES ($1, $2, $3, $4, $5)
                                    `,
                                    [id, position.товар_id, position.количество, position.цена, normalizeVatRateId(position.ндс_id)]
                                );
                            }
                        }

                        if (nextAffectsStock) {
                            await ensureDirectShipmentStockAvailable(client, nextDirectPositions);
                            await applyDirectShipmentStockChange(client, Number(id), nextDirectPositions, 'out');
                        }
                    }
                }

                if (previousOrderId == null) {
                    await recalculateShipmentDeliveryCostIfNeeded(client, Number(id));
                    await syncStandaloneShipmentFinanceRecord(client, Number(id));
                } else {
                    await recalculateShipmentDeliveryCostIfNeeded(client, Number(id));
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
            const orderId = shipment.заявка_id == null ? null : Number(shipment.заявка_id);
            const isDirectShipment = orderId == null;
            const isActiveDirectShipment = isDirectShipment && isActiveShipmentStatus(shipment.статус) && !toBoolean(shipment.без_учета_склада, false);

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                if (isActiveDirectShipment) {
                    const positionsResult = await client.query(
                        'SELECT product_id AS "товар_id", quantity AS "количество", price AS "цена", vat_id AS "ндс_id" FROM public.shipment_positions WHERE shipment_id = $1 ORDER BY id',
                        [id]
                    );
                    const currentPositions = normalizeDirectShipmentPositions(positionsResult.rows);
                    await applyDirectShipmentStockChange(client, Number(id), currentPositions, 'back');
                }
                await client.query('DELETE FROM "Финансы_компании" WHERE "отгрузка_id" = $1', [id]);
                await client.query('DELETE FROM "Отгрузки" WHERE id = $1 RETURNING *', [id]);
                await client.query('COMMIT');
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }

            if (orderId != null) {
                await syncOrderWorkflowStatus(orderId);
            }

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
