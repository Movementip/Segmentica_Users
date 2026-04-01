import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, query } from '../../lib/db';
import { requirePermission } from '../../lib/auth';
import { calculateVatAmountsFromLine, DEFAULT_VAT_RATE_ID, getVatRateOption, isValidVatRateId, normalizeVatRateId } from '../../lib/vat';
import { syncOrderWorkflowStatus } from '../../lib/orderWorkflow';
import { checkAndCreateMissingProducts, syncMissingProductsFromPurchases } from '../../lib/missingProductsHelper';
import { syncOrderPositionsFromLinkedPurchases } from '../../lib/orderFulfillment';
import { normalizeOrderExecutionMode } from '../../lib/orderModes';
import { ensureLogisticsDeliverySchema, normalizeDeliveryCost, toBoolean } from '../../lib/logisticsDelivery';
import { syncPurchaseWarehouseState } from '../../lib/purchaseWarehouse';
import { syncPurchaseFinanceRecord } from '../../lib/companyFinance';

const calculatePurchasePositionsTotal = (positions: Array<{ количество: number; цена: number; ндс_id?: number }>) => (
    positions.reduce((sum, item) => {
        const vatRate = getVatRateOption(item?.ндс_id ?? DEFAULT_VAT_RATE_ID).rate;
        return sum + calculateVatAmountsFromLine(Number(item?.количество), Number(item?.цена), vatRate).total;
    }, 0)
);

const calculatePurchaseTotal = (
    positions: Array<{ количество: number; цена: number; ндс_id?: number }>,
    deliveryCost?: number | null
) => (
    calculatePurchasePositionsTotal(positions) + (Number(deliveryCost) || 0)
);

const purchaseTotalExpression = `
  (
    COALESCE(totals.total_amount, 0)
    + CASE
      WHEN COALESCE(з."использовать_доставку", false)
        THEN COALESCE(з."стоимость_доставки", 0)
      ELSE 0
    END
  )::numeric
`;

export interface CreatePurchaseRequest {
    create_token?: string;
    поставщик_id: number;
    заявка_id?: number;
    дата_поступления?: string;
    статус: string;
    использовать_доставку?: boolean;
    транспорт_id?: number | null;
    стоимость_доставки?: number | null;
    позиции: {
        товар_id: number;
        количество: number;
        цена: number;
        ндс_id?: number;
    }[];
}

interface UpdatePurchaseRequest {
    id: number;
    статус?: string;
    дата_поступления?: string;
    поставщик_id?: number;
    заявка_id?: number | null;
    использовать_доставку?: boolean;
    транспорт_id?: number | null;
    стоимость_доставки?: number | null;
    позиции?: {
        товар_id: number;
        количество: number;
        цена: number;
        ндс_id?: number;
    }[];
}

const normalizePositionFingerprint = (positions: CreatePurchaseRequest['позиции']) => (
    positions
        .map((position) => ({
            товар_id: Number(position.товар_id),
            количество: Number(position.количество),
            цена: Number(position.цена),
            ндс_id: normalizeVatRateId(position.ндс_id),
        }))
        .sort((a, b) => a.товар_id - b.товар_id || a.цена - b.цена || a.количество - b.количество || a.ндс_id - b.ндс_id)
);

const arePositionFingerprintsEqual = (
    left: ReturnType<typeof normalizePositionFingerprint>,
    right: ReturnType<typeof normalizePositionFingerprint>
) => (
    left.length === right.length
    && left.every((item, index) => (
        item.товар_id === right[index].товар_id
        && item.количество === right[index].количество
        && item.цена === right[index].цена
        && item.ндс_id === right[index].ндс_id
    ))
);

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { id } = req.query;
    await ensureLogisticsDeliverySchema();

    if (req.method === 'GET') {
        const actor = await requirePermission(req, res, id ? 'purchases.view' : 'purchases.list');
        if (!actor) return;
        try {
            // If ID is provided, fetch single purchase with positions
            if (id) {
                // Get single purchase with supplier information
                const purchaseResult = await query(`
          SELECT 
            з.*,
            ${purchaseTotalExpression} as "общая_сумма",
            п."название" as поставщик_название,
            п."телефон" as поставщик_телефон,
            п."email" as поставщик_email,
            COALESCE(п."адрес_печати", п."адрес_регистрации") as поставщик_адрес,
            п."тип" as поставщик_тип,
            п."краткое_название" as поставщик_краткое_название,
            п."полное_название" as поставщик_полное_название,
            п."фамилия" as поставщик_фамилия,
            п."имя" as поставщик_имя,
            п."отчество" as поставщик_отчество,
            п."инн" as поставщик_инн,
            п."кпп" as поставщик_кпп,
            п."огрн" as поставщик_огрн,
            п."огрнип" as поставщик_огрнип,
            п."окпо" as поставщик_окпо,
            п."адрес_регистрации" as поставщик_адрес_регистрации,
            п."адрес_печати" as поставщик_адрес_печати,
            п."паспорт_серия" as поставщик_паспорт_серия,
            п."паспорт_номер" as поставщик_паспорт_номер,
            п."паспорт_кем_выдан" as поставщик_паспорт_кем_выдан,
            п."паспорт_дата_выдачи" as поставщик_паспорт_дата_выдачи,
            п."паспорт_код_подразделения" as поставщик_паспорт_код_подразделения,
            п."комментарий" as поставщик_комментарий,
            к."id" as клиент_id,
            к."название" as клиент_название,
            к."телефон" as клиент_телефон,
            к."email" as клиент_email,
            к."адрес" as клиент_адрес,
            к."тип" as клиент_тип,
            к."краткое_название" as клиент_краткое_название,
            к."полное_название" as клиент_полное_название,
            к."фамилия" as клиент_фамилия,
            к."имя" as клиент_имя,
            к."отчество" as клиент_отчество,
            к."инн" as клиент_инн,
            к."кпп" as клиент_кпп,
            к."огрн" as клиент_огрн,
            к."огрнип" as клиент_огрнип,
            к."окпо" as клиент_окпо,
            к."адрес_регистрации" as клиент_адрес_регистрации,
            к."адрес_печати" as клиент_адрес_печати,
            к."комментарий" as клиент_комментарий,
            тк."название" as транспорт_название
          FROM "Закупки" з
          LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
          LEFT JOIN "Заявки" за ON з."заявка_id" = за.id
          LEFT JOIN "Клиенты" к ON за."клиент_id" = к.id
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

                // Get purchase positions with product information
                const positionsResult = await query(`
          SELECT 
            пз.*,
            т."название" as товар_название,
            т."артикул" as товар_артикул
          FROM "Позиции_закупки" пз
          LEFT JOIN "Товары" т ON пз."товар_id" = т.id
          WHERE пз."закупка_id" = $1
        `, [id]);

                // Add calculated sum field to positions
                const positions = positionsResult.rows.map(position => ({
                    ...position,
                    ндс_id: position.ндс_id == null ? null : Number(position.ндс_id),
                    сумма: position.количество * position.цена
                }));

                // Return purchase with positions
                res.status(200).json({
                    ...purchase,
                    позиции: positions
                });
            } else {
                // Get all purchases with supplier information
                const result = await query(`
          SELECT 
            з.*,
            ${purchaseTotalExpression} as "общая_сумма",
            п."название" as поставщик_название,
            п."телефон" as поставщик_телефон,
            п."email" as поставщик_email,
            COALESCE(п."адрес_печати", п."адрес_регистрации") as поставщик_адрес,
            п."тип" as поставщик_тип,
            п."краткое_название" as поставщик_краткое_название,
            п."полное_название" as поставщик_полное_название,
            п."фамилия" as поставщик_фамилия,
            п."имя" as поставщик_имя,
            п."отчество" as поставщик_отчество,
            п."инн" as поставщик_инн,
            п."кпп" as поставщик_кпп,
            п."огрн" as поставщик_огрн,
            п."огрнип" as поставщик_огрнип,
            п."окпо" as поставщик_окпо,
            п."адрес_регистрации" as поставщик_адрес_регистрации,
            п."адрес_печати" as поставщик_адрес_печати,
            п."паспорт_серия" as поставщик_паспорт_серия,
            п."паспорт_номер" as поставщик_паспорт_номер,
            п."паспорт_кем_выдан" as поставщик_паспорт_кем_выдан,
            п."паспорт_дата_выдачи" as поставщик_паспорт_дата_выдачи,
            п."паспорт_код_подразделения" as поставщик_паспорт_код_подразделения,
            п."комментарий" as поставщик_комментарий,
            тк."название" as транспорт_название
          FROM "Закупки" з
          LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
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
          ORDER BY з."дата_заказа" DESC
        `);

                res.status(200).json(result.rows);
            }
        } catch (error) {
            console.error('Error fetching purchases:', error);
            res.status(500).json({ error: 'Failed to fetch purchases' });
        }
    } else if (req.method === 'POST') {
        const actor = await requirePermission(req, res, 'purchases.create');
        if (!actor) return;
        try {
            const sourceHeader = String(req.headers['x-purchase-create-source'] || '').trim().toLowerCase();
            if (sourceHeader !== 'manual-modal') {
                return res.status(409).json({
                    error: 'Создание закупки отклонено: обнаружен устаревший или неподдерживаемый источник запроса. Обновите страницу и попробуйте снова.'
                });
            }

            const {
                create_token,
                поставщик_id,
                заявка_id,
                дата_поступления,
                статус,
                использовать_доставку,
                транспорт_id,
                стоимость_доставки,
                позиции
            }: CreatePurchaseRequest = req.body;

            if (!create_token || typeof create_token !== 'string') {
                return res.status(409).json({
                    error: 'Создание закупки отклонено: отсутствует одноразовый токен формы. Обновите страницу и откройте модалку заново.'
                });
            }

            const tokenKey = `purchase_create_token:${create_token}`;
            const tokenResult = await query(
                'SELECT key, updated_at FROM app_settings WHERE key = $1',
                [tokenKey]
            );

            if (tokenResult.rows.length === 0) {
                return res.status(409).json({
                    error: 'Создание закупки отклонено: токен формы не найден или уже использован. Обновите страницу и попробуйте снова.'
                });
            }

            const tokenUpdatedAt = tokenResult.rows[0]?.updated_at ? new Date(tokenResult.rows[0].updated_at).getTime() : 0;
            const tokenAgeMs = Date.now() - tokenUpdatedAt;

            if (!Number.isFinite(tokenAgeMs) || tokenAgeMs < 0 || tokenAgeMs > 10 * 60 * 1000) {
                await query('DELETE FROM app_settings WHERE key = $1', [tokenKey]);
                return res.status(409).json({
                    error: 'Создание закупки отклонено: токен формы устарел. Обновите страницу и откройте модалку заново.'
                });
            }

            await query('DELETE FROM app_settings WHERE key = $1', [tokenKey]);

            // Validate required fields
            if (!поставщик_id || !статус || !позиции || позиции.length === 0) {
                return res.status(400).json({
                    error: 'Поставщик, статус и позиции обязательны'
                });
            }

            // Validate supplier exists
            const supplierCheck = await query(
                'SELECT id FROM "Поставщики" WHERE id = $1',
                [поставщик_id]
            );

            if (supplierCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Поставщик не найден' });
            }

            const useDelivery = toBoolean(использовать_доставку, false);
            const normalizedTransportId = useDelivery && транспорт_id != null ? Number(транспорт_id) : null;
            const normalizedDeliveryCost = useDelivery ? normalizeDeliveryCost(стоимость_доставки) : null;

            if (useDelivery && (!normalizedTransportId || normalizedTransportId <= 0)) {
                return res.status(400).json({ error: 'При включенной доставке нужно выбрать транспортную компанию' });
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

            // Validate all products exist
            for (const position of позиции) {
                const productCheck = await query(
                    'SELECT id FROM "Товары" WHERE id = $1',
                    [position.товар_id]
                );

                if (productCheck.rows.length === 0) {
                    return res.status(400).json({
                        error: `Товар с ID ${position.товар_id} не найден`
                    });
                }

                if (!isValidVatRateId(position?.ндс_id ?? DEFAULT_VAT_RATE_ID)) {
                    return res.status(400).json({ error: 'Некорректная ставка НДС в позициях закупки' });
                }
            }

            // Calculate total amount
            const общая_сумма = calculatePurchaseTotal(позиции, normalizedDeliveryCost);
            const incomingFingerprint = normalizePositionFingerprint(позиции);

            const duplicateCandidates = await query(`
              SELECT
                id,
                "общая_сумма"
              FROM "Закупки"
              WHERE "поставщик_id" = $1
                AND COALESCE("заявка_id", 0) = COALESCE($2, 0)
                AND COALESCE("статус", 'заказано') = $3
                AND COALESCE("статус", 'заказано') != 'отменено'
              ORDER BY id DESC
            `, [поставщик_id, заявка_id || null, статус]);

            for (const candidate of duplicateCandidates.rows) {
                const candidateTotal = Number(candidate.общая_сумма) || 0;
                if (Math.abs(candidateTotal - общая_сумма) > 0.01) continue;

                const candidatePositionsResult = await query(`
                  SELECT "товар_id", "количество", "цена", "ндс_id"
                  FROM "Позиции_закупки"
                  WHERE "закупка_id" = $1
                  ORDER BY id
                `, [candidate.id]);

                const candidateFingerprint = normalizePositionFingerprint(candidatePositionsResult.rows as any);
                if (arePositionFingerprintsEqual(incomingFingerprint, candidateFingerprint)) {
                    return res.status(200).json({
                        message: 'Закупка уже была создана',
                        purchaseId: candidate.id,
                        общая_сумма: candidateTotal
                    });
                }
            }

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const txQuery = (text: string, params?: any[]) => client.query(text, params);
                let orderExecutionMode = 'warehouse';
                if (заявка_id) {
                    const orderModeResult = await txQuery(
                        'SELECT "режим_исполнения" FROM "Заявки" WHERE id = $1 LIMIT 1',
                        [заявка_id]
                    );
                    orderExecutionMode = normalizeOrderExecutionMode(orderModeResult.rows[0]?.режим_исполнения);
                }

                // Create purchase
                const purchaseResult = await txQuery(`
          INSERT INTO "Закупки" (
            "поставщик_id", "заявка_id", "дата_заказа", "дата_поступления", 
            "статус", "общая_сумма", "использовать_доставку", "транспорт_id", "стоимость_доставки"
          ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
                    поставщик_id,
                    заявка_id,
                    дата_поступления,
                    статус,
                    общая_сумма,
                    useDelivery,
                    normalizedTransportId,
                    normalizedDeliveryCost,
                ]);

                const purchaseId = purchaseResult.rows[0].id;

                // Create purchase positions
                for (const position of позиции) {
                    await txQuery(`
            INSERT INTO "Позиции_закупки" (
              "закупка_id", "товар_id", "количество", "цена", "ндс_id"
            ) VALUES ($1, $2, $3, $4, $5)
          `, [purchaseId, position.товар_id, position.количество, position.цена, normalizeVatRateId(position.ндс_id)]);
                }

                await syncPurchaseWarehouseState({ query: txQuery }, purchaseId, статус === 'получено' && orderExecutionMode !== 'direct');
                await syncPurchaseFinanceRecord({ query: txQuery }, purchaseId);

                await client.query('COMMIT');

                if (заявка_id) {
                    await syncOrderPositionsFromLinkedPurchases(query, Number(заявка_id));
                    await checkAndCreateMissingProducts(Number(заявка_id));
                    await syncMissingProductsFromPurchases(Number(заявка_id));
                    await syncOrderWorkflowStatus(Number(заявка_id));
                }

                res.status(201).json({
                    message: 'Закупка успешно создана',
                    purchaseId,
                    общая_сумма
                });
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error creating purchase:', error);
            res.status(500).json({
                error: 'Ошибка создания закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'PUT') {
        const actor = await requirePermission(req, res, 'purchases.edit');
        if (!actor) return;
        try {
            const {
                статус,
                дата_поступления,
                поставщик_id,
                заявка_id,
                использовать_доставку,
                транспорт_id,
                стоимость_доставки,
                позиции
            }: UpdatePurchaseRequest = req.body;
            const existingPurchaseResult = await query(
                'SELECT id, "заявка_id", "использовать_доставку", "транспорт_id", "стоимость_доставки" FROM "Закупки" WHERE id = $1',
                [id]
            );

            if (existingPurchaseResult.rows.length === 0) {
                return res.status(404).json({ error: 'Закупка не найдена' });
            }

            const previousOrderId = existingPurchaseResult.rows[0].заявка_id == null ? null : Number(existingPurchaseResult.rows[0].заявка_id);

            if (!id) {
                return res.status(400).json({ error: 'ID закупки обязателен' });
            }

            // Validate that at least one field is provided
            if (
                !статус &&
                !дата_поступления &&
                typeof поставщик_id === 'undefined' &&
                typeof заявка_id === 'undefined' &&
                typeof использовать_доставку === 'undefined' &&
                typeof транспорт_id === 'undefined' &&
                typeof стоимость_доставки === 'undefined' &&
                typeof позиции === 'undefined'
            ) {
                return res.status(400).json({ error: 'Нет данных для обновления' });
            }

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const txQuery = (text: string, params?: any[]) => client.query(text, params);
                // If supplier_id provided, validate supplier exists
                if (typeof поставщик_id !== 'undefined') {
                    const supplierCheck = await txQuery('SELECT id FROM "Поставщики" WHERE id = $1', [поставщик_id]);
                    if (supplierCheck.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Поставщик не найден' });
                    }
                }

                const useDelivery = typeof использовать_доставку === 'undefined'
                    ? undefined
                    : toBoolean(использовать_доставку, false);
                const normalizedTransportId = typeof транспорт_id === 'undefined'
                    ? undefined
                    : транспорт_id == null || транспорт_id === 0
                        ? null
                        : Number(транспорт_id);
                const normalizedDeliveryCost = typeof стоимость_доставки === 'undefined'
                    ? undefined
                    : normalizeDeliveryCost(стоимость_доставки);

                const effectiveUseDelivery = typeof useDelivery === 'undefined'
                    ? toBoolean(existingPurchaseResult.rows[0]?.использовать_доставку, false)
                    : useDelivery;
                const effectiveTransportId = effectiveUseDelivery
                    ? (
                        typeof normalizedTransportId === 'undefined'
                            ? (existingPurchaseResult.rows[0]?.транспорт_id == null ? null : Number(existingPurchaseResult.rows[0].транспорт_id))
                            : normalizedTransportId
                    )
                    : null;
                const effectiveDeliveryCost = effectiveUseDelivery
                    ? (
                        typeof normalizedDeliveryCost === 'undefined'
                            ? normalizeDeliveryCost(existingPurchaseResult.rows[0]?.стоимость_доставки)
                            : normalizedDeliveryCost
                    )
                    : 0;

                if (effectiveUseDelivery && (!effectiveTransportId || effectiveTransportId <= 0)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'При включенной доставке нужно выбрать транспортную компанию' });
                }

                if (effectiveTransportId) {
                    const transportCheck = await txQuery('SELECT id FROM "Транспортные_компании" WHERE id = $1', [effectiveTransportId]);
                    if (transportCheck.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Транспортная компания не найдена' });
                    }
                }

                // If positions provided, validate all products exist and are valid
                if (typeof позиции !== 'undefined') {
                    if (!Array.isArray(позиции) || позиции.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Позиции обязательны' });
                    }

                    for (const pos of позиции) {
                        if (!pos || !pos.товар_id || pos.количество <= 0 || pos.цена <= 0) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: 'Позиции содержат некорректные данные' });
                        }

                        if (!isValidVatRateId(pos?.ндс_id ?? DEFAULT_VAT_RATE_ID)) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: 'Позиции содержат некорректную ставку НДС' });
                        }

                        const productCheck = await txQuery('SELECT id FROM "Товары" WHERE id = $1', [pos.товар_id]);
                        if (productCheck.rows.length === 0) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: `Товар с ID ${pos.товар_id} не найден` });
                        }
                    }
                }

                const shouldRecalculateTotal = (
                    typeof позиции !== 'undefined'
                    || typeof useDelivery !== 'undefined'
                    || typeof normalizedDeliveryCost !== 'undefined'
                    || typeof normalizedTransportId !== 'undefined'
                );
                let recalculatedTotal: number | undefined;

                if (shouldRecalculateTotal) {
                    const positionsForTotal = typeof позиции !== 'undefined'
                        ? позиции
                        : (await txQuery(
                            'SELECT "товар_id", "количество", "цена", "ндс_id" FROM "Позиции_закупки" WHERE "закупка_id" = $1 ORDER BY id',
                            [id]
                        )).rows;
                    recalculatedTotal = calculatePurchaseTotal(positionsForTotal as Array<{ количество: number; цена: number; ндс_id?: number }>, effectiveDeliveryCost);
                }

                // Update purchase
                const updateFields: string[] = [];
                const values: any[] = [];
                let paramCount = 1;

                if (статус) {
                    updateFields.push(`"статус" = $${paramCount}`);
                    values.push(статус);
                    paramCount++;
                }

                if (дата_поступления) {
                    updateFields.push(`"дата_поступления" = $${paramCount}`);
                    values.push(дата_поступления);
                    paramCount++;
                }

                if (typeof поставщик_id !== 'undefined') {
                    updateFields.push(`"поставщик_id" = $${paramCount}`);
                    values.push(поставщик_id);
                    paramCount++;
                }

                if (typeof заявка_id !== 'undefined') {
                    updateFields.push(`"заявка_id" = $${paramCount}`);
                    values.push(заявка_id);
                    paramCount++;
                }

                if (typeof useDelivery !== 'undefined') {
                    updateFields.push(`"использовать_доставку" = $${paramCount}`);
                    values.push(useDelivery);
                    paramCount++;
                }

                if (typeof normalizedTransportId !== 'undefined' || typeof useDelivery !== 'undefined') {
                    updateFields.push(`"транспорт_id" = $${paramCount}`);
                    values.push(effectiveUseDelivery ? effectiveTransportId : null);
                    paramCount++;
                }

                if (typeof normalizedDeliveryCost !== 'undefined' || typeof useDelivery !== 'undefined') {
                    updateFields.push(`"стоимость_доставки" = $${paramCount}`);
                    values.push(effectiveUseDelivery ? effectiveDeliveryCost : null);
                    paramCount++;
                }

                if (typeof recalculatedTotal !== 'undefined') {
                    updateFields.push(`"общая_сумма" = $${paramCount}`);
                    values.push(recalculatedTotal);
                    paramCount++;
                }

                values.push(id);

                const purchaseResult = await txQuery(`
          UPDATE "Закупки"
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `, values);

                if (purchaseResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Закупка не найдена' });
                }

                const updatedPurchase = purchaseResult.rows[0];

                // Replace positions if provided
                if (typeof позиции !== 'undefined') {
                    await txQuery('DELETE FROM "Позиции_закупки" WHERE "закупка_id" = $1', [id]);
                    for (const pos of позиции) {
                        await txQuery(`
              INSERT INTO "Позиции_закупки" ("закупка_id", "товар_id", "количество", "цена", "ндс_id")
              VALUES ($1, $2, $3, $4, $5)
            `, [id, pos.товар_id, pos.количество, pos.цена, normalizeVatRateId(pos.ндс_id)]);
                    }
                }

                let orderExecutionMode = 'warehouse';
                if (updatedPurchase.заявка_id != null) {
                    const orderModeResult = await txQuery(
                        'SELECT "режим_исполнения" FROM "Заявки" WHERE id = $1 LIMIT 1',
                        [updatedPurchase.заявка_id]
                    );
                    orderExecutionMode = normalizeOrderExecutionMode(orderModeResult.rows[0]?.режим_исполнения);
                }

                await syncPurchaseWarehouseState(
                    { query: txQuery },
                    Number(id),
                    normalizeOrderExecutionMode(orderExecutionMode) !== 'direct'
                    && String(updatedPurchase.статус || '').trim().toLowerCase() === 'получено'
                );
                await syncPurchaseFinanceRecord({ query: txQuery }, Number(id));

                await client.query('COMMIT');

                const nextOrderId = updatedPurchase.заявка_id == null ? null : Number(updatedPurchase.заявка_id);
                const orderIdsToSync = [previousOrderId, nextOrderId].filter(
                    (value, index, array): value is number => value != null && array.indexOf(value) === index
                );

                for (let index = 0; index < orderIdsToSync.length; index += 1) {
                    await syncOrderPositionsFromLinkedPurchases(query, orderIdsToSync[index]);
                    await checkAndCreateMissingProducts(orderIdsToSync[index]);
                    await syncMissingProductsFromPurchases(orderIdsToSync[index]);
                    await syncOrderWorkflowStatus(orderIdsToSync[index]);
                }

                res.status(200).json(updatedPurchase);
            } catch (transactionError) {
                await client.query('ROLLBACK');
                throw transactionError;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error updating purchase:', error);
            res.status(500).json({
                error: 'Ошибка обновления закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'DELETE') {
        const actor = await requirePermission(req, res, 'purchases.delete');
        if (!actor) return;
        try {
            if (!id) {
                return res.status(400).json({ error: 'ID закупки обязателен' });
            }

            const purchaseResult = await query(
                'SELECT id, "заявка_id", COALESCE("статус", \'заказано\') as "статус" FROM "Закупки" WHERE id = $1',
                [id]
            );

            if (purchaseResult.rows.length === 0) {
                return res.status(404).json({ error: 'Закупка не найдена' });
            }

            const orderId = purchaseResult.rows[0].заявка_id == null ? null : Number(purchaseResult.rows[0].заявка_id);
            const purchaseStatus = String(purchaseResult.rows[0].статус || '').toLowerCase();
            const purchaseId = Number(id);

            const pool = await getPool();
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const txQuery = (text: string, params?: any[]) => client.query(text, params);

                const positionsResult = await txQuery(
                    'SELECT "товар_id", COALESCE("количество", 0)::integer as quantity FROM "Позиции_закупки" WHERE "закупка_id" = $1',
                    [purchaseId]
                );

                if (purchaseStatus === 'получено') {
                    for (const position of positionsResult.rows) {
                        const productId = Number(position.товар_id);
                        const quantity = Number(position.quantity) || 0;

                        const warehouseResult = await txQuery(
                            'SELECT COALESCE("количество", 0)::integer as quantity FROM "Склад" WHERE "товар_id" = $1',
                            [productId]
                        );

                        const currentQty = Number(warehouseResult.rows[0]?.quantity) || 0;
                        if (currentQty < quantity) {
                            await client.query('ROLLBACK');
                            return res.status(409).json({
                                error: 'Нельзя удалить полученную закупку: часть товара уже использована в складе или других операциях'
                            });
                        }

                        await txQuery(
                            'UPDATE "Склад" SET "количество" = "количество" - $1 WHERE "товар_id" = $2',
                            [quantity, productId]
                        );
                    }
                }

                await txQuery('DELETE FROM "Финансы_компании" WHERE "закупка_id" = $1', [purchaseId]);
                await txQuery('DELETE FROM "Движения_склада" WHERE "закупка_id" = $1', [purchaseId]);
                await txQuery('DELETE FROM "Позиции_закупки" WHERE "закупка_id" = $1', [purchaseId]);
                const result = await txQuery('DELETE FROM "Закупки" WHERE id = $1 RETURNING *', [purchaseId]);

                await client.query('COMMIT');

                if (orderId) {
                    await syncOrderPositionsFromLinkedPurchases(query, orderId);
                    await checkAndCreateMissingProducts(orderId);
                    await syncMissingProductsFromPurchases(orderId);
                    await syncOrderWorkflowStatus(orderId);
                }

                res.status(200).json({ message: 'Закупка успешно удалена', deletedPurchase: result.rows[0] });
            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error deleting purchase:', error);
            res.status(500).json({
                error: 'Ошибка удаления закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
            });
        }
    } else if (req.method === 'HEAD') {
        res.status(405).end();
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
    }
}
