import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './Header.module.css';
import {
    FiUser,
    FiSearch,
    FiX,
    FiPackage,
    FiShoppingBag,
    FiFolder,
    FiTruck,
    FiUser as FiClient,
    FiDatabase
} from 'react-icons/fi';

interface HeaderProps {
    onMenuToggle?: () => void;
    pageTitle?: string;
}

interface SearchResult {
    id: number;
    type: 'product' | 'client' | 'order' | 'category' | 'supplier';
    title: string;
    subtitle: string;
    price?: number;
    status?: string;
    date?: string;
    phone?: string;
}

interface SearchResults {
    products: SearchResult[];
    clients: SearchResult[];
    orders: SearchResult[];
    categories: SearchResult[];
    suppliers: SearchResult[];
}

export function Header({ pageTitle: propPageTitle }: HeaderProps): JSX.Element {
    const router = useRouter();
    const defaultPageTitle = router.pathname.startsWith('/reports') ? 'Отчеты' : 'Дашборд';
    const pageTitle = propPageTitle || defaultPageTitle;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResults>({
        products: [],
        clients: [],
        orders: [],
        categories: [],
        suppliers: []
    });
    const [isSearching, setIsSearching] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Handle search input changes with debounce
    useEffect(() => {
        const search = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults({
                    products: [],
                    clients: [],
                    orders: [],
                    categories: [],
                    suppliers: []
                });
                return;
            }

            setIsSearching(true);
            try {
                const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
                const data = await response.json();
                setSearchResults({
                    products: data.products || [],
                    clients: data.clients || [],
                    orders: data.orders || [],
                    categories: data.categories || [],
                    suppliers: data.suppliers || []
                });
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timerId = setTimeout(search, 300);
        return () => clearTimeout(timerId);
    }, [searchQuery]);

    // Close search results when clicking outside or when input loses focus
    useEffect(() => {
        const clearResults = () => {
            setSearchQuery('');
            setSearchResults({
                products: [],
                clients: [],
                orders: [],
                categories: [],
                suppliers: []
            });
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                clearResults();
            }
        };

        const handleBlur = (event: FocusEvent) => {
            // Use setTimeout to allow click events to be processed before clearing
            setTimeout(() => {
                if (searchRef.current && !searchRef.current.contains(document.activeElement)) {
                    clearResults();
                }
            }, 200);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('focusin', handleBlur);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('focusin', handleBlur);
        };
    }, []);

    const handleResultClick = (result: SearchResult) => {
        setSearchQuery('');
        setSearchResults({
            products: [],
            clients: [],
            orders: [],
            categories: [],
            suppliers: []
        });

        switch (result.type) {
            case 'product':
                router.push(`/products/${result.id}`);
                break;
            case 'client':
                router.push(`/clients/${result.id}`);
                break;
            case 'order':
                router.push(`/orders/${result.id}`);
                break;
            case 'category':
                router.push(`/categories/${result.id}`);
                break;
            case 'supplier':
                router.push(`/suppliers/${result.id}`);
                break;
        }
    };

    const hasResults =
        searchResults.products.length > 0 ||
        searchResults.clients.length > 0 ||
        searchResults.orders.length > 0 ||
        searchResults.categories.length > 0 ||
        searchResults.suppliers.length > 0;

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <h1 className={styles.pageTitle}>{pageTitle}</h1>
            </div>

            <div className={styles.rightSection}>
                <div className={styles.searchWrapper} ref={searchRef}>
                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Поиск по заявкам, товарам, клиентам..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setSearchResults(prev => ({
                                products: [...prev.products],
                                clients: [...prev.clients],
                                orders: [...prev.orders],
                                categories: [...prev.categories],
                                suppliers: [...prev.suppliers]
                            }))}
                            title="Поиск по всем разделам системы"
                        />
                        {searchQuery ? (
                            <button
                                className={styles.clearButton}
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults({
                                        products: [],
                                        clients: [],
                                        orders: [],
                                        categories: [],
                                        suppliers: []
                                    });
                                }}
                            >
                                <FiX size={18} />
                            </button>
                        ) : (
                            <div className={styles.searchButton}>
                                <FiSearch />
                            </div>
                        )}
                    </div>

                    {(isSearching || (searchResults && searchQuery.length >= 2)) && (
                        <div className={styles.searchResults}>
                            {isSearching ? (
                                <div className={styles.loading}>Загрузка...</div>
                            ) : hasResults ? (
                                <>
                                    {searchResults.products.length > 0 && (
                                        <div className={styles.resultsSection}>
                                            <div className={styles.sectionTitle}>
                                                <FiPackage className={styles.sectionIcon} data-type="product" />
                                                Товары
                                            </div>
                                            {searchResults.products.map((product) => (
                                                <div
                                                    key={`product-${product.id}`}
                                                    className={styles.resultItem}
                                                    data-type="product"
                                                    onClick={() => handleResultClick(product)}
                                                >
                                                    <div className={styles.resultTitle}>{product.title}</div>
                                                    <div className={styles.resultSubtitle}>
                                                        {product.subtitle} • {product.price} ₽
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.clients.length > 0 && (
                                        <div className={styles.resultsSection}>
                                            <div className={styles.sectionTitle}>
                                                <FiUser className={styles.sectionIcon} data-type="client" />
                                                Клиенты
                                            </div>
                                            {searchResults.clients.map((client) => (
                                                <div
                                                    key={`client-${client.id}`}
                                                    className={styles.resultItem}
                                                    data-type="client"
                                                    onClick={() => handleResultClick(client)}
                                                >
                                                    <div className={styles.resultTitle}>{client.title}</div>
                                                    <div className={styles.resultSubtitle}>
                                                        {client.subtitle}
                                                        {client.date && ` • ${client.date}`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.orders.length > 0 && (
                                        <div className={styles.resultsSection}>
                                            <div className={styles.sectionTitle}>
                                                <FiShoppingBag className={styles.sectionIcon} data-type="order" />
                                                Заказы
                                            </div>
                                            {searchResults.orders.map((order) => (
                                                <div
                                                    key={`order-${order.id}`}
                                                    className={styles.resultItem}
                                                    data-type="order"
                                                    onClick={() => handleResultClick(order)}
                                                >
                                                    <div className={styles.resultTitle}>
                                                        {order.title} •
                                                        <span className={`${styles.status} ${order.status === 'completed' ? styles.statusCompleted :
                                                            order.status === 'processing' ? styles.statusProcessing :
                                                                styles.statusPending
                                                            }`}>
                                                            {order.status === 'completed' ? 'Завершен' :
                                                                order.status === 'processing' ? 'В обработке' : 'В ожидании'}
                                                        </span>
                                                    </div>
                                                    <div className={styles.resultSubtitle}>
                                                        {order.subtitle}
                                                        {order.date && ` • ${order.date}`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.categories.length > 0 && (
                                        <div className={styles.resultsSection}>
                                            <div className={styles.sectionTitle}>
                                                <FiFolder className={styles.sectionIcon} data-type="category" />
                                                Категории
                                            </div>
                                            {searchResults.categories.map((category) => (
                                                <div
                                                    key={`category-${category.id}`}
                                                    className={styles.resultItem}
                                                    data-type="category"
                                                    onClick={() => handleResultClick(category)}
                                                >
                                                    <div className={styles.resultTitle}>{category.title}</div>
                                                    <div className={styles.resultSubtitle}>
                                                        {category.subtitle}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.suppliers.length > 0 && (
                                        <div className={styles.resultsSection}>
                                            <div className={styles.sectionTitle}>
                                                <FiTruck className={styles.sectionIcon} data-type="supplier" />
                                                Поставщики
                                            </div>
                                            {searchResults.suppliers.map((supplier) => (
                                                <div
                                                    key={`supplier-${supplier.id}`}
                                                    className={styles.resultItem}
                                                    data-type="supplier"
                                                    onClick={() => handleResultClick(supplier)}
                                                >
                                                    <div className={styles.resultTitle}>{supplier.title}</div>
                                                    <div className={styles.resultSubtitle}>
                                                        {supplier.subtitle}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : searchQuery.length >= 2 ? (
                                <div className={styles.noResults}>Ничего не найдено</div>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className={styles.dbInfo}>
                    <div className={styles.dbIcon}>
                        <FiDatabase />
                    </div>
                    <div className={styles.dbDetails}>
                        <div className={styles.dbName}>
                            <span className={styles.dbLabel}>DB:</span> {process.env.NEXT_PUBLIC_DB_NAME || 'Segmentica'}
                        </div>
                        <div className={styles.dbConnection}>
                            <span className={styles.dbLabel}>Host:</span> {process.env.NEXT_PUBLIC_DB_HOST || 'localhost'}:{process.env.NEXT_PUBLIC_DB_PORT || '5436'}
                        </div>
                        <div className={styles.dbUser}>
                            <span className={styles.dbLabel}>User:</span> {process.env.NEXT_PUBLIC_DB_USER || 'postgres'}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
