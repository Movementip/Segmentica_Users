import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query: searchQuery } = req.query;

    if (!searchQuery || typeof searchQuery !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const searchTerm = `%${searchQuery}%`;
        console.log('Searching for:', searchQuery);

        // Search in products
        const products = await searchProducts(searchTerm);

        // Search in clients
        const clients = await searchClients(searchTerm);

        // Search in orders
        const orders = await searchOrders(searchTerm);

        // Search in categories
        const categories = await searchCategories(searchTerm);

        // Search in suppliers
        const suppliers = await searchSuppliers(searchTerm);

        // Combine all results
        const results = {
            products,
            clients,
            orders,
            categories,
            suppliers
        };

        console.log('Search results:', {
            query: searchQuery,
            products: products.length,
            clients: clients.length,
            orders: orders.length,
            categories: categories.length,
            suppliers: suppliers.length
        });

        res.status(200).json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

async function searchProducts(searchTerm: string): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, артикул, цена_продажи, категория
       FROM "Товары" 
       WHERE LOWER("название") LIKE LOWER($1) 
       OR LOWER("артикул") LIKE LOWER($1)
       OR LOWER("категория") LIKE LOWER($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchTerm]
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

async function searchClients(searchTerm: string): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, телефон, email, created_at
       FROM "Клиенты"
       WHERE LOWER("название") LIKE LOWER($1)
       OR LOWER("телефон") LIKE LOWER($1)
       OR LOWER("email") LIKE LOWER($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchTerm]
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

async function searchOrders(searchTerm: string): Promise<SearchResult[]> {
    console.log('Поиск заявок по запросу:', searchTerm);

    try {
        // Удаляем лишние пробелы и переводим в нижний регистр для обработки
        const cleanTerm = searchTerm.trim().toLowerCase();

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
          з.общая_сумма,
          з.адрес_доставки,
          к.название as клиент_название,
          с.фио as менеджер_фио
        FROM "Заявки" з
        LEFT JOIN "Клиенты" к ON з.клиент_id = к.id
        LEFT JOIN "Сотрудники" с ON з.менеджер_id = с.id
        WHERE з.id = $1
        ORDER BY з.дата_создания DESC
        LIMIT 1`;  // Ограничиваем одной записью, так как ищем по ID
            queryParams = [requestId];
        } else {
            // Обычный поиск по всем полям
            const searchPattern = `%${searchTerm}%`;
            const numericId = isNaN(Number(searchTerm)) ? -1 : Number(searchTerm);

            queryText = `
        SELECT 
          з.id, 
          з.статус, 
          з.дата_создания,
          з.общая_сумма,
          з.адрес_доставки,
          к.название as клиент_название,
          с.фио as менеджер_фио
        FROM "Заявки" з
        LEFT JOIN "Клиенты" к ON з.клиент_id = к.id
        LEFT JOIN "Сотрудники" с ON з.менеджер_id = с.id
        WHERE 
          CAST(з.id AS TEXT) LIKE $1
          OR LOWER(з.статус) LIKE LOWER($2)
          OR LOWER(к.название) LIKE LOWER($2)
          OR LOWER(с.фио) LIKE LOWER($2)
          OR (LOWER(з.адрес_доставки) LIKE LOWER($2) AND з.адрес_доставки IS NOT NULL)
        ORDER BY з.дата_создания DESC
        LIMIT 10`;
            queryParams = [numericId.toString(), searchPattern];
        }

        console.log('Выполняем SQL запрос:', queryText);
        console.log('Параметры запроса:', queryParams);

        const result = await query(queryText, queryParams);

        console.log('Результат запроса:', result.rows.length, 'найдено записей');
        if (result.rows.length > 0) {
            console.log('Первая найденная запись:', result.rows[0]);
        }

        return result.rows.map(order => {
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
            const cleanStatus = (order.статус || '').trim().toLowerCase();
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
        });
    } catch (error) {
        console.error('Ошибка при поиске заявок:', error);
        return [];
    }
}

async function searchCategories(searchTerm: string): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, описание
       FROM "Категории_товаров"
       WHERE (LOWER("название") LIKE LOWER($1)
       OR LOWER("описание") LIKE LOWER($1))
       AND "активна" = true
       ORDER BY "название"
       LIMIT 10`,
            [searchTerm]
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

async function searchSuppliers(searchTerm: string): Promise<SearchResult[]> {
    try {
        const result = await query(
            `SELECT id, название, телефон, email, рейтинг, created_at
       FROM "Поставщики"
       WHERE LOWER("название") LIKE LOWER($1)
       OR LOWER("телефон") LIKE LOWER($1)
       OR LOWER("email") LIKE LOWER($1)
       ORDER BY "название"
       LIMIT 10`,
            [searchTerm]
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
