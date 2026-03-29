import type { NextApiRequest, NextApiResponse } from 'next';
import { withTransaction } from '../../../lib/db';
import { requirePermission } from '../../../lib/auth';
import { getNextShipmentBranchMeta, getRemainingShipmentDraft } from '../../../lib/orderFulfillment';
import { syncOrderWorkflowStatus } from '../../../lib/orderWorkflow';
import { recalculateShipmentDeliveryCostIfNeeded } from '../../../lib/shipmentDeliveryCost';

type ImportRow = {
    заявка_id: number;
    транспорт_id: number;
    статус?: string | null;
    номер_отслеживания?: string | null;
    дата_отгрузки?: string | null;
    стоимость_доставки?: number | null;
    товар_id?: number | null;
    количество?: number | null;
    цена?: number | null;
    ндс_id?: number | null;
    позиции?: Array<{
        товар_id?: number | null;
        количество?: number | null;
        цена?: number | null;
        ндс_id?: number | null;
    }> | null;
};

const toNumberOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const s = String(v).replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const toStringOrNull = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
};

const getOrderPositionsFallback = async (
    client: { query: (text: string, params?: any[]) => Promise<any> },
    orderId: number
) => {
    const result = await client.query(
        `
            SELECT
                "товар_id",
                COALESCE("количество", 0)::numeric AS quantity,
                COALESCE("цена", 0)::numeric AS price,
                COALESCE("ндс_id", 5)::integer AS vat_id
            FROM "Позиции_заявки"
            WHERE "заявка_id" = $1
            ORDER BY id
        `,
        [orderId]
    );

    return result.rows
        .map((row) => ({
            товар_id: Number(row.товар_id) || 0,
            количество: Number(row.quantity) || 0,
            цена: Number(row.price) || 0,
            ндс_id: Number(row.vat_id) || 5,
        }))
        .filter((row) => row.товар_id > 0 && row.количество > 0);
};

const getExplicitShipmentPositions = (raw: ImportRow) => {
    const fromArray = Array.isArray(raw?.позиции)
        ? raw.позиции
            .map((row) => ({
                товар_id: Number(row?.товар_id) || 0,
                количество: Number(row?.количество) || 0,
                цена: Number(row?.цена) || 0,
                ндс_id: Number(row?.ндс_id) || 5,
            }))
            .filter((row) => row.товар_id > 0 && row.количество > 0 && row.цена > 0)
        : [];

    if (fromArray.length > 0) {
        return fromArray;
    }

    const single = {
        товар_id: Number((raw as any)?.товар_id) || 0,
        количество: Number((raw as any)?.количество) || 0,
        цена: Number((raw as any)?.цена) || 0,
        ндс_id: Number((raw as any)?.ндс_id) || 5,
    };

    return single.товар_id > 0 && single.количество > 0 && single.цена > 0
        ? [single]
        : [];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const actor = await requirePermission(req, res, 'shipments.import.excel');
    if (!actor) return;

    const actor1 = await requirePermission(req, res, 'shipments.delete');
    if (!actor1) return;

    const actor2 = await requirePermission(req, res, 'shipments.create');
    if (!actor2) return;

    try {
        const { rows } = req.body as { rows?: ImportRow[] };
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'rows обязателен' });
        }

        if (rows.length > 5000) {
            return res.status(400).json({ error: 'Слишком много строк для импорта (макс. 5000)' });
        }

        const orderUsage = new Map<number, number[]>();
        rows.forEach((raw, index) => {
            const orderId = toNumberOrNull((raw as any)?.заявка_id);
            if (!orderId || orderId <= 0) return;
            const current = orderUsage.get(orderId) || [];
            current.push(index);
            orderUsage.set(orderId, current);
        });

        const duplicateOrderErrors = Array.from(orderUsage.entries())
            .filter(([, indexes]) => indexes.length > 1)
            .flatMap(([orderId, indexes]) => {
                const hasExplicitPositionsForEveryRow = indexes.every((index) => getExplicitShipmentPositions(rows[index] as ImportRow).length > 0);
                if (hasExplicitPositionsForEveryRow) {
                    return [];
                }

                return indexes.map((index) => ({
                    index,
                    error: `заявка_id=${orderId} встречается несколько раз. Для split-отгрузок у каждой строки нужны явные позиции: либо массив "позиции", либо колонки "товар_id", "количество", "цена" и опционально "ндс_id".`,
                }));
            });

        if (duplicateOrderErrors.length > 0) {
            return res.status(400).json({
                error: 'Импорт содержит неоднозначные split-отгрузки',
                hint: 'Исторические split-отгрузки без строковых позиций невозможно восстановить однозначно. Добавьте позиции по каждой строке отгрузки.',
                details: duplicateOrderErrors.slice(0, 50),
            });
        }

        try {
            const result = await withTransaction(async (client) => {
                const linkedShipmentIdsResult = await client.query(`
                    SELECT id
                    FROM "Отгрузки"
                    WHERE "заявка_id" IS NOT NULL
                `);
                const linkedShipmentIds = linkedShipmentIdsResult.rows
                    .map((row) => Number(row.id))
                    .filter((value) => Number.isFinite(value));

                const ordersRes = await client.query('SELECT id FROM "Заявки"');
                const orderIds = new Set<number>((ordersRes.rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n)));

                const transportsRes = await client.query('SELECT id FROM "Транспортные_компании"');
                const transportIds = new Set<number>((transportsRes.rows || []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n)));

                const errors: Array<{ index: number; error: string }> = [];

                for (let i = 0; i < rows.length; i++) {
                    const raw = rows[i] as ImportRow;
                    const orderId = toNumberOrNull((raw as any)?.заявка_id);
                    const transportId = toNumberOrNull((raw as any)?.транспорт_id);

                    if (!orderId || orderId <= 0) {
                        errors.push({ index: i, error: 'заявка_id обязателен' });
                        continue;
                    }

                    if (!transportId || transportId <= 0) {
                        errors.push({ index: i, error: 'транспорт_id обязателен' });
                        continue;
                    }

                    if (!orderIds.has(orderId)) {
                        errors.push({ index: i, error: `заявка_id=${orderId} не найдена` });
                        continue;
                    }

                    if (!transportIds.has(transportId)) {
                        errors.push({ index: i, error: `транспорт_id=${transportId} не найден` });
                        continue;
                    }

                    const status = toStringOrNull((raw as any)?.статус) || 'в пути';
                    const track = toStringOrNull((raw as any)?.номер_отслеживания);
                    const shippedAt = toStringOrNull((raw as any)?.дата_отгрузки);
                    const cost = toNumberOrNull((raw as any)?.стоимость_доставки);

                    void status;
                    void track;
                    void shippedAt;
                    void cost;
                }

                if (errors.length > 0) {
                    return { errors: errors.slice(0, 50) };
                }

                if (linkedShipmentIds.length > 0) {
                    await client.query(
                        'DELETE FROM "Финансы_компании" WHERE "отгрузка_id" = ANY($1::int[])',
                        [linkedShipmentIds]
                    );
                    await client.query(
                        'DELETE FROM "Отгрузки" WHERE id = ANY($1::int[])',
                        [linkedShipmentIds]
                    );
                }

                const affectedOrderIds = Array.from(new Set(rows.map((row) => Number(row.заявка_id)).filter((value) => Number.isFinite(value) && value > 0)));
                const fallbackUsedForOrders = new Set<number>();

                // Insert in reverse order to preserve visible ordering when list API sorts by date DESC.
                for (let i = rows.length - 1; i >= 0; i--) {
                    const raw = rows[i] as ImportRow;

                    const orderId = Number(raw.заявка_id);
                    const transportId = Number(raw.транспорт_id);
                    const status = toStringOrNull((raw as any)?.статус) || 'в пути';
                    const track = toStringOrNull((raw as any)?.номер_отслеживания);
                    const shippedAt = toStringOrNull((raw as any)?.дата_отгрузки);
                    const cost = toNumberOrNull((raw as any)?.стоимость_доставки);
                    const branchMeta = await getNextShipmentBranchMeta(client, orderId);
                    const insertValuesBase = [
                        orderId,
                        true,
                        false,
                        transportId,
                        status,
                        track,
                        cost,
                        branchMeta.branchNo,
                        branchMeta.shipmentKind,
                    ];
                    let insertedShipmentId: number | null = null;

                    if (shippedAt) {
                        const insertedResult = await client.query(
                            `INSERT INTO "Отгрузки" (
                            "заявка_id",
                            "использовать_доставку",
                            "без_учета_склада",
                            "транспорт_id",
                            "статус",
                            "номер_отслеживания",
                            "дата_отгрузки",
                            "стоимость_доставки",
                            branch_no,
                            shipment_kind
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING id`,
                            [...insertValuesBase.slice(0, 6), shippedAt, ...insertValuesBase.slice(6)]
                        );
                        insertedShipmentId = Number(insertedResult.rows[0]?.id) || null;
                    } else {
                        const insertedResult = await client.query(
                            `INSERT INTO "Отгрузки" (
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
                        RETURNING id`,
                            insertValuesBase
                        );
                        insertedShipmentId = Number(insertedResult.rows[0]?.id) || null;
                    }

                    if (insertedShipmentId) {
                        const explicitPositions = getExplicitShipmentPositions(raw);
                        let positionsToInsert = explicitPositions;
                        if (positionsToInsert.length === 0) {
                            positionsToInsert = await getRemainingShipmentDraft(client, orderId);
                            if (positionsToInsert.length === 0 && !fallbackUsedForOrders.has(orderId)) {
                                positionsToInsert = await getOrderPositionsFallback(client, orderId);
                                if (positionsToInsert.length > 0) {
                                    fallbackUsedForOrders.add(orderId);
                                }
                            }
                        }

                        for (const position of positionsToInsert) {
                            await client.query(
                                `
                                    INSERT INTO public.shipment_positions (shipment_id, product_id, quantity, price, vat_id)
                                    VALUES ($1, $2, $3, $4, $5)
                                `,
                                [insertedShipmentId, position.товар_id, position.количество, position.цена, position.ндс_id]
                            );
                        }

                        await recalculateShipmentDeliveryCostIfNeeded(client, insertedShipmentId, { skipIfCostAlreadySet: true });
                    }
                }

                return {
                    inserted: rows.length,
                    deletedLinkedShipments: linkedShipmentIds.length,
                    affectedOrderIds,
                };
            });

            if ('errors' in result) {
                return res.status(400).json({ error: 'Импорт содержит ошибки', details: result.errors });
            }

            for (const orderId of result.affectedOrderIds) {
                await syncOrderWorkflowStatus(orderId);
            }

            return res.status(200).json({
                message: 'Импорт выполнен',
                inserted: result.inserted,
                deletedLinkedShipments: result.deletedLinkedShipments,
                mode: 'replace_linked_shipments',
            });
        } catch (e) {
            throw e;
        }
    } catch (error) {
        console.error('Shipments import error:', error);
        return res.status(500).json({ error: 'Ошибка импорта отгрузок' });
    }
}
