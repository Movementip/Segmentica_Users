import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { hasPermission, requireAuth } from '../../lib/auth';
import { getOrderWorkflowSummary, getWorkflowDisplayStatus } from '../../lib/orderWorkflow';

interface SearchResult {
    id: number;
    type: 'product' | 'client' | 'order' | 'category' | 'supplier';
    title: string;
    subtitle: string;
    price?: number;
    status?: string;
    date?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const actor = await requireAuth(req, res);
    if (!actor) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query: searchQuery } = req.query;

    if (!searchQuery || typeof searchQuery !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
    }

    const canSearchProducts = hasPermission(actor, 'products.list') || hasPermission(actor, 'products.view');
    const canSearchClients = hasPermission(actor, 'clients.list') || hasPermission(actor, 'clients.view');
    const canSearchOrders =
        hasPermission(actor, 'orders.list')
        || hasPermission(actor, 'orders.view')
        || hasPermission(actor, 'clients.orders_history.view');
    const canSearchSuppliers = hasPermission(actor, 'suppliers.list') || hasPermission(actor, 'suppliers.view');
    const canSearchCategories = canSearchProducts;

    if (!canSearchProducts && !canSearchClients && !canSearchOrders && !canSearchSuppliers && !canSearchCategories) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const rawQuery = searchQuery.trim();
        const searchPatterns = [
            `%${rawQuery}%`,
            `%${rawQuery.toLocaleLowerCase('ru-RU')}%`,
            `%${rawQuery.toLocaleUpperCase('ru-RU')}%`
        ];

        // Search in products
        const products = canSearchProducts ? await searchProducts(searchPatterns) : [];

        // Search in clients
        const clients = canSearchClients ? await searchClients(searchPatterns) : [];

        // Search in orders
        const orders = canSearchOrders ? await searchOrders(rawQuery, searchPatterns) : [];

        // Search in categories
        const categories = canSearchCategories ? await searchCategories(searchPatterns) : [];

        // Search in suppliers
        const suppliers = canSearchSuppliers ? await searchSuppliers(searchPatterns) : [];

        // Combine all results
        const results = {
            products,
            clients,
            orders,
            categories,
            suppliers
        };

        res.status(200).json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

async function searchProducts(searchPatterns: string[]): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, артикул, цена_продажи, категория
       FROM "Товары" 
       WHERE "название" LIKE ANY($1)
       OR "артикул" LIKE ANY($1)
       OR "категория" LIKE ANY($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchPatterns]
        );

        return result.rows.map(product => ({
            id: product.id,
            type: 'product' as const,
            title: product.название,
            subtitle: `Арт. ${product.артикул} • ${product.категория || 'Без категории'}`,
            price: product.цена_продажи
        }));
    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

async function searchClients(searchPatterns: string[]): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, телефон, email, created_at
       FROM "Клиенты"
       WHERE "название" LIKE ANY($1)
       OR "телефон" LIKE ANY($1)
       OR "email" LIKE ANY($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchPatterns]
        );

        return result.rows.map(client => ({
            id: client.id,
            type: 'client' as const,
            title: client.название,
            subtitle: [client.телефон, client.email].filter(Boolean).join(' • '),
            date: new Date(client.created_at).toLocaleDateString()
        }));
    } catch (error) {
        console.error('Error searching clients:', error);
        return [];
    }
}

async function searchOrders(rawQuery: string, searchPatterns: string[]): Promise<SearchResult[]> {
    try {
        // Удаляем лишние пробелы и переводим в нижний регистр для обработки
        const cleanTerm = rawQuery.trim().toLowerCase();

        // Проверяем различные форматы:
        // 1. "заявка 9"
        // 2. "заявка9"
        // 3. "заявка №9"
        // 4. "№9"
        // 5. просто число "9"
        let requestId: number | null = null;

        // Пытаемся извлечь число из строки разными способами
        const patterns = [
            /заявка[\s№]*(\d+)/,  // "заявка 9", "заявка9", "заявка №9"
            /№[\s]*(\d+)/,        // "№9", "№ 9"
            /(^|\s)(\d+)($|\s)/,  // просто число "9"
            /(\d+)/               // любое число в строке
        ];

        for (const pattern of patterns) {
            const match = cleanTerm.match(pattern);
            if (match) {
                requestId = parseInt(match[1] || match[2] || match[0], 10);
                if (!isNaN(requestId)) {
                    console.log('Найден ID заявки по шаблону:', pattern, 'ID:', requestId);
                    break;
                }
            }
        }

        let queryText: string;
        let queryParams: any[];

        if (requestId) {
            // Если нашли число в запросе - ищем по ID
            queryText = `
        SELECT 
          з.id, 
          з.статус, 
          з.дата_создания,
          (
            COALESCE(order_totals.items_total, 0)
            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as общая_сумма,
          з.адрес_доставки,
          к.название as клиент_название,
          с.фио as менеджер_фио
        FROM "Заявки" з
        LEFT JOIN "Клиенты" к ON з.клиент_id = к.id
        LEFT JOIN "Сотрудники" с ON з.менеджер_id = с.id
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
        ) order_totals ON order_totals."заявка_id" = з.id
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
        ) purchase_logistics ON purchase_logistics."заявка_id" = з.id
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
        ) shipment_logistics ON shipment_logistics."заявка_id" = з.id
        WHERE з.id = $1
        ORDER BY з.дата_создания DESC
        LIMIT 1`;  // Ограничиваем одной записью, так как ищем по ID
            queryParams = [requestId];
        } else {
            // Обычный поиск по всем полям
            const numericId = isNaN(Number(rawQuery)) ? -1 : Number(rawQuery);

            queryText = `
        SELECT 
          з.id, 
          з.статус, 
          з.дата_создания,
          (
            COALESCE(order_totals.items_total, 0)
            + COALESCE(purchase_logistics.purchase_delivery_total, 0)
            + COALESCE(shipment_logistics.shipment_delivery_total, 0)
          )::numeric as общая_сумма,
          з.адрес_доставки,
          к.название as клиент_название,
          с.фио as менеджер_фио
        FROM "Заявки" з
        LEFT JOIN "Клиенты" к ON з.клиент_id = к.id
        LEFT JOIN "Сотрудники" с ON з.менеджер_id = с.id
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
        ) order_totals ON order_totals."заявка_id" = з.id
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
        ) purchase_logistics ON purchase_logistics."заявка_id" = з.id
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
        ) shipment_logistics ON shipment_logistics."заявка_id" = з.id
        WHERE 
          CAST(з.id AS TEXT) LIKE $1
          OR з.статус LIKE ANY($2)
          OR к.название LIKE ANY($2)
          OR с.фио LIKE ANY($2)
          OR (з.адрес_доставки LIKE ANY($2) AND з.адрес_доставки IS NOT NULL)
        ORDER BY з.дата_создания DESC
        LIMIT 10`;
            queryParams = [numericId.toString(), searchPatterns];
        }

        const result = await query(queryText, queryParams);

        return Promise.all(result.rows.map(async (order) => {
            const workflow = await getOrderWorkflowSummary(Number(order.id));
            const displayStatus = getWorkflowDisplayStatus(workflow);
            const statusMap: Record<string, string> = {
                'новая': 'Новая',
                'в работе': 'В работе',
                'в_работе': 'В работе',
                'на согласовании': 'На согласовании',
                'на_согласовании': 'На согласовании',
                'выполнена': 'Выполнена',
                'отменена': 'Отменена',
                'в пути': 'В пути',
                'в_пути': 'В пути',
                'доставлена': 'Доставлена',
                'ожидает оплаты': 'Ожидает оплаты',
                'ожидает_оплаты': 'Ожидает оплаты',
                'оплачена': 'Оплачена',
                'отгружена': 'Отгружена',
                'завершена': 'Завершена',
                'в обработке': 'В обработке',
                'в_обработке': 'В обработке',
                'принята': 'Принята',
                'обрабатывается': 'Обрабатывается',
                'отклонена': 'Отклонена'
            };

            // Clean the status text
            const cleanStatus = (displayStatus || order.статус || '').trim().toLowerCase();
            // Only use status if it's in our mapping
            const statusText = statusMap[cleanStatus] || '';
            const managerInfo = order.менеджер_фио ? ` • ${order.менеджер_фио}` : '';
            const amountInfo = order.общая_сумма ? ` • ${order.общая_сумма} ₽` : '';

            // Remove any trailing status from the client name
            const clientName = (order.клиент_название || 'Без клиента').split('•')[0].trim();

            return {
                id: order.id,
                type: 'order' as const,
                title: `Заявка #${order.id}${statusText ? ` • ${statusText}` : ''}`,
                subtitle: `${clientName}${managerInfo}${amountInfo}`,
                status: statusText,
                date: new Date(order.дата_создания).toLocaleDateString(),
                price: order.общая_сумма
            };
        }));
    } catch (error) {
        console.error('Ошибка при поиске заявок:', error);
        return [];
    }
}

async function searchCategories(searchPatterns: string[]): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, описание
       FROM "Категории_товаров"
       WHERE ("название" LIKE ANY($1)
       OR "описание" LIKE ANY($1))
       AND "активна" = true
       ORDER BY "название"
       LIMIT 10`,
            [searchPatterns]
        );

        return result.rows.map(category => ({
            id: category.id,
            type: 'category' as const,
            title: category.название,
            subtitle: category.описание || 'Без описания'
        }));
    } catch (error) {
        console.error('Error searching categories:', error);
        return [];
    }
}

async function searchSuppliers(searchPatterns: string[]): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, телефон, email, рейтинг, created_at
       FROM "Поставщики"
       WHERE "название" LIKE ANY($1)
       OR "телефон" LIKE ANY($1)
       OR "email" LIKE ANY($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchPatterns]
        );

        return result.rows.map(supplier => ({
            id: supplier.id,
            type: 'supplier' as const,
            title: supplier.название,
            subtitle: [supplier.телефон, supplier.email, supplier.рейтинг ? `Рейтинг: ${supplier.рейтинг}` : ''].filter(Boolean).join(' • ')
        }));
    } catch (error) {
        console.error('Error searching suppliers:', error);
        return [];
    }
}
