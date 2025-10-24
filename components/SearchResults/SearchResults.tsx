import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX, FiPackage, FiUser, FiFileText } from 'react-icons/fi';
import { useRouter } from 'next/router';
import styles from './SearchResults.module.css';

interface Product {
    id: string;
    name: string;
    article: string;
    type: string;
}

interface Client {
    id: string;
    name: string;
    phone: string;
    email: string;
}

interface Order {
    id: string;
    status: string;
    statusText?: string;
    title?: string;
    client?: {
        name: string;
    };
    name: string;
    subtitle?: string;
    price?: number | string;
    date?: string;
}

interface SearchResult {
    products: Product[];
    clients: Client[];
    orders: Order[];
}

const SearchResults: React.FC = () => {
    const formatStatus = (status: string): string => {
        if (!status) return '';

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
            'отклонена': 'Отклонена',
            'подтверждена': 'Подтверждена'
        };

        // Clean the status text and handle different status formats
        let cleanStatus = status.toLowerCase().trim();
        // Replace underscores with spaces for better matching
        cleanStatus = cleanStatus.replace(/_/g, ' ');

        return statusMap[cleanStatus] || status;
    };
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult>({
        products: [],
        clients: [],
        orders: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Закрытие выпадающего списка при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Обработка поискового запроса
    useEffect(() => {
        const search = async () => {
            if (query.trim().length < 2) {
                setResults({
                    products: [],
                    clients: [],
                    orders: []
                });
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                setResults(data);
                setIsOpen(true);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timerId = setTimeout(search, 300);
        return () => clearTimeout(timerId);
    }, [query]);

    const handleResultClick = (type: string, id: string) => {
        setIsOpen(false);
        setQuery('');

        switch (type) {
            case 'product':
                router.push(`/products/${id}`);
                break;
            case 'client':
                router.push(`/clients/${id}`);
                break;
            case 'order':
                router.push(`/orders/${id}`);
                break;
            default:
                break;
        }
    };

    const hasResults =
        results.products.length > 0 ||
        results.clients.length > 0 ||
        results.orders.length > 0;

    return (
        <div className={styles.searchContainer} ref={searchRef}>
            <div className={styles.searchInputContainer}>
                <input
                    ref={inputRef}
                    type="text"
                    className={styles.searchInput}
                    placeholder="Поиск по заявкам, товарам, клиентам..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                {query ? (
                    <button
                        className={styles.clearButton}
                        onClick={() => {
                            setQuery('');
                            setResults({
                                products: [],
                                clients: [],
                                orders: []
                            });
                            inputRef.current?.focus();
                        }}
                    >
                        <FiX size={18} />
                    </button>
                ) : (
                    <div className={styles.searchIcon}>
                        <FiSearch size={18} />
                    </div>
                )}
            </div>

            {isOpen && (isLoading || (query.length >= 2 && hasResults)) && (
                <div className={styles.resultsDropdown}>
                    {isLoading ? (
                        <div className={styles.loading}>Загрузка...</div>
                    ) : (
                        <>
                            {results?.products.length > 0 && (
                                <div className={styles.resultsSection}>
                                    <div className={styles.sectionTitle}>
                                        <FiPackage className={styles.sectionIcon} />
                                        Товары
                                    </div>
                                    {results.products.map((product) => (
                                        <div
                                            key={`product-${product.id}`}
                                            className={styles.resultItem}
                                            onClick={() => handleResultClick('product', product.id)}
                                        >
                                            <div className={styles.resultTitle}>{product.name}</div>
                                            <div className={styles.resultSubtitle}>
                                                Арт. {product.article} • {product.type}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results?.clients.length > 0 && (
                                <div className={styles.resultsSection}>
                                    <div className={styles.sectionTitle}>
                                        <FiUser className={styles.sectionIcon} />
                                        Клиенты
                                    </div>
                                    {results.clients.map((client) => (
                                        <div
                                            key={`client-${client.id}`}
                                            className={styles.resultItem}
                                            onClick={() => handleResultClick('client', client.id)}
                                        >
                                            <div className={styles.resultTitle}>{client.name}</div>
                                            <div className={styles.resultSubtitle}>
                                                {client.phone} • {client.email}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results?.orders.length > 0 && (
                                <div className={styles.resultsSection}>
                                    <div className={styles.sectionTitle}>
                                        <FiFileText className={styles.sectionIcon} />
                                        Заявки
                                    </div>
                                    {results.orders.map((order) => (
                                        <div
                                            key={`order-${order.id}`}
                                            className={styles.resultItem}
                                            onClick={() => handleResultClick('order', order.id)}
                                        >
                                            {order.status && (
                                                <span className={`${styles.status} ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                                    {formatStatus(order.status)}
                                                </span>
                                            )}
                                            <div className={styles.resultTitle}>
                                                {order.title || `Заявка #${order.id}`}
                                            </div>
                                            <div className={styles.resultSubtitle}>
                                                {order.client?.name || 'Без клиента'}
                                                {order.price ? ` • ${order.price} ₽` : ''}
                                                {order.date ? ` • ${order.date}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!hasResults && (
                                <div className={styles.noResults}>
                                    Ничего не найдено. Попробуйте изменить запрос.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchResults;
