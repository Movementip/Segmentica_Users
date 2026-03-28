import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './Header.module.css';
import { FiSearch, FiX, FiPackage, FiUser } from 'react-icons/fi';
import {
    FiShoppingBag,
    FiFolder,
    FiTruck,
    FiDatabase
} from 'react-icons/fi';
import { Box, Card, DropdownMenu, Flex, ScrollArea, Separator, Text, TextField } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';

interface SearchResult {
    id: string;
    type: 'product' | 'client' | 'order' | 'category' | 'supplier';
    title: string;
    subtitle: string;
    price?: number;
    date?: string;
    status?: string;
    phone?: string;
}

interface SearchResults {
    orders: SearchResult[];
    clients: SearchResult[];
    products: SearchResult[];
    categories: SearchResult[];
    suppliers: SearchResult[];
}

export function Header(): JSX.Element {
    const router = useRouter();
    const { user, logout, setTheme } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState<'default' | 'sku' | 'supplier' | 'category'>('default');
    const searchRef = useRef<HTMLDivElement>(null);
    const [searchResults, setSearchResults] = useState<SearchResults>({
        orders: [],
        clients: [],
        products: [],
        categories: [],
        suppliers: []
    });

    const [dbStatus, setDbStatus] = useState<{ isRemote: boolean; mode: 'local' | 'remote'; remoteAvailable: boolean } | null>(null);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [isDbSwitching, setIsDbSwitching] = useState(false);

    const fetchDbStatus = async () => {
        try {
            const response = await fetch('/api/db-status');
            if (!response.ok) return;
            const data = await response.json();
            setDbStatus({
                isRemote: Boolean(data.isRemote),
                mode: data.mode === 'remote' ? 'remote' : 'local',
                remoteAvailable: Boolean(data.remoteAvailable)
            });
        } catch (error) {
            console.error('Failed to fetch DB status:', error);
        } finally {
            setIsDbLoading(false);
        }
    };

    useEffect(() => {
        fetchDbStatus();
        const t = window.setInterval(fetchDbStatus, 10000);
        return () => window.clearInterval(t);
    }, []);

    const switchDbMode = async (mode: 'local' | 'remote') => {
        setIsDbSwitching(true);
        try {
            const response = await fetch('/api/db-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            if (!response.ok) return;
            await fetchDbStatus();
        } catch (error) {
            console.error('Failed to switch DB mode:', error);
        } finally {
            setIsDbSwitching(false);
        }
    };

    // Handle search input changes with debounce
    useEffect(() => {
        const search = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults({
                    orders: [],
                    clients: [],
                    products: [],
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
                    orders: data.orders || [],
                    clients: data.clients || [],
                    products: data.products || [],
                    categories: data.categories || [],
                    suppliers: data.suppliers || []
                });
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults({
                    orders: [],
                    clients: [],
                    products: [],
                    categories: [],
                    suppliers: []
                });
            } finally {
                setIsSearching(false);
            }
        };

        const timerId = setTimeout(search, 300);
        return () => clearTimeout(timerId);
    }, [searchQuery]);

    // Close search results when clicking outside or when input loses focus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };

        const handleBlur = (event: FocusEvent) => {
            // Use setTimeout to allow click events to be processed before clearing
            setTimeout(() => {
                if (searchRef.current && !searchRef.current.contains(document.activeElement)) {
                    setIsSearchOpen(false);
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
        setIsSearchOpen(false);

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

    const handleExampleClick = (value: string) => {
        setIsSearchOpen(true);
        setSearchMode('default');
        setSearchQuery(value);
        setTimeout(() => {
            const el = searchRef.current?.querySelector('input') as HTMLInputElement | null;
            el?.focus();
        }, 0);
    };

    const handleModeHintClick = (mode: 'sku' | 'supplier' | 'category') => {
        setIsSearchOpen(true);
        setSearchMode(mode);
        setTimeout(() => {
            const el = searchRef.current?.querySelector('input') as HTMLInputElement | null;
            el?.focus();
        }, 0);
    };

    const placeholder =
        searchMode === 'sku'
            ? 'Введите артикул / SKU…'
            : searchMode === 'supplier'
                ? 'Введите название поставщика…'
                : searchMode === 'category'
                    ? 'Введите категорию…'
                    : 'Например: заявка #5, Иванов, +7…';

    const showDropdown = isSearchOpen;
    const isQueryReady = searchQuery.trim().length >= 2;

    const hasResults =
        searchResults.orders.length > 0 ||
        searchResults.clients.length > 0 ||
        searchResults.products.length > 0 ||
        searchResults.categories.length > 0 ||
        searchResults.suppliers.length > 0;

    const getStatusColor = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'новая':
                return '#1976d2';
            case 'в обработке':
                return '#f57c00';
            case 'подтверждена':
                return '#7b1fa2';
            case 'в работе':
                return '#0288d1';
            case 'собрана':
                return '#5d4037';
            case 'отгружена':
                return '#00897b';
            case 'выполнена':
                return '#388e3c';
            case 'отменена':
                return '#d32f2f';
            default:
                return '#616161';
        }
    };

    const renderSectionHeader = (
        icon: React.ReactNode,
        title: string
    ) => (
        <Flex align="center" gap="2" className={styles.sectionHeader}>
            <Box className={styles.sectionHeaderIcon}>{icon}</Box>
            <Text size="3" weight="bold" color="gray">
                {title}
            </Text>
        </Flex>
    );

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <div className={styles.leftSpacer} />
            </div>

            <div className={styles.rightSection}>
                <div className={styles.searchWrapper} ref={searchRef}>
                    <TextField.Root
                        className={styles.searchField}
                        size="3"
                        variant="surface"
                        radius="large"
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        title="Поиск по всем разделам системы"
                    >
                        <TextField.Slot>
                            <FiSearch className={styles.searchIcon} />
                        </TextField.Slot>

                        {searchQuery ? (
                            <TextField.Slot>
                                <button
                                    type="button"
                                    className={styles.clearButton}
                                    onClick={() => {
                                        setSearchQuery('');
                                        setIsSearchOpen(true);
                                        setSearchResults({
                                            products: [],
                                            clients: [],
                                            orders: [],
                                            categories: [],
                                            suppliers: []
                                        });
                                    }}
                                    aria-label="Очистить поиск"
                                >
                                    <FiX size={18} />
                                </button>
                            </TextField.Slot>
                        ) : null}
                    </TextField.Root>

                    {showDropdown && (
                        <div className={styles.searchResults}>
                            <Card size="2" variant="surface" className={styles.searchCard}>
                                <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 520 }}>
                                    <Flex direction="column" className={styles.searchCardInner}>
                                        {!isQueryReady ? (
                                            <Box className={styles.searchEmpty}>
                                                <Text size="3" weight="bold">
                                                    Что можно найти
                                                </Text>
                                                <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                    Введи минимум 2 символа. Примеры:
                                                </Text>

                                                <div className={styles.exampleGrid}>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('заявка #5')}
                                                    >
                                                        заявка #5
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('ИП Иванов')}
                                                    >
                                                        ИП Иванов
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleExampleClick('+7')}
                                                    >
                                                        +7… (телефон)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('sku')}
                                                    >
                                                        артикул / SKU
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('supplier')}
                                                    >
                                                        поставщик
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.exampleChip}
                                                        onClick={() => handleModeHintClick('category')}
                                                    >
                                                        категория
                                                    </button>
                                                </div>
                                            </Box>
                                        ) : isSearching ? (
                                            <Box className={styles.loading}>
                                                <Text size="2" color="gray">
                                                    Загрузка...
                                                </Text>
                                            </Box>
                                        ) : hasResults ? (
                                            <>
                                                {searchResults.orders.length > 0 && (
                                                    <Box>
                                                        {renderSectionHeader(
                                                            <FiShoppingBag className={styles.sectionIcon} data-type="order" />,
                                                            'Заказы'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.orders.map((order) => (
                                                                <Box
                                                                    key={`order-${order.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="order"
                                                                    onClick={() => handleResultClick(order)}
                                                                >
                                                                    <Flex align="center" gap="2" wrap="wrap">
                                                                        <Text size="3" weight="bold">
                                                                            {order.title}
                                                                        </Text>
                                                                        {order.status ? (
                                                                            <div
                                                                                className={styles.statusBadge}
                                                                                style={{
                                                                                    backgroundColor: `${getStatusColor(order.status)}15`,
                                                                                    color: getStatusColor(order.status),
                                                                                    border: `1px solid ${getStatusColor(order.status)}40`
                                                                                }}
                                                                            >
                                                                                {order.status}
                                                                            </div>
                                                                        ) : null}
                                                                    </Flex>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {order.subtitle}
                                                                        {order.date && ` • ${order.date}`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.clients.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiUser className={styles.sectionIcon} data-type="client" />,
                                                            'Клиенты'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.clients.map((client) => (
                                                                <Box
                                                                    key={`client-${client.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="client"
                                                                    onClick={() => handleResultClick(client)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {client.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {client.subtitle}
                                                                        {client.date && ` • ${client.date}`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.products.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiPackage className={styles.sectionIcon} data-type="product" />,
                                                            'Товары'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.products.map((product) => (
                                                                <Box
                                                                    key={`product-${product.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="product"
                                                                    onClick={() => handleResultClick(product)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {product.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {product.subtitle}
                                                                        {typeof product.price === 'number' && ` • ${product.price} ₽`}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.categories.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiFolder className={styles.sectionIcon} data-type="category" />,
                                                            'Категории'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.categories.map((category) => (
                                                                <Box
                                                                    key={`category-${category.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="category"
                                                                    onClick={() => handleResultClick(category)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {category.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {category.subtitle}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}

                                                {searchResults.suppliers.length > 0 && (
                                                    <Box style={{ marginTop: 12 }}>
                                                        {renderSectionHeader(
                                                            <FiTruck className={styles.sectionIcon} data-type="supplier" />,
                                                            'Поставщики'
                                                        )}
                                                        <Separator size="4" />
                                                        <Flex direction="column">
                                                            {searchResults.suppliers.map((supplier) => (
                                                                <Box
                                                                    key={`supplier-${supplier.id}`}
                                                                    className={styles.resultRow}
                                                                    data-type="supplier"
                                                                    onClick={() => handleResultClick(supplier)}
                                                                >
                                                                    <Text size="3" weight="bold">
                                                                        {supplier.title}
                                                                    </Text>
                                                                    <Text size="2" color="gray" style={{ marginTop: 4 }}>
                                                                        {supplier.subtitle}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Flex>
                                                    </Box>
                                                )}
                                            </>
                                        ) : (
                                            <Box className={styles.noResults}>
                                                <Text size="2" color="gray">
                                                    Ничего не найдено
                                                </Text>
                                            </Box>
                                        )}
                                    </Flex>
                                </ScrollArea>
                            </Card>
                        </div>
                    )}
                </div>

                <div className={styles.dbInfo}>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                            <button
                                type="button"
                                className={styles.dbButton}
                                disabled={isDbLoading}
                                aria-label="Переключение базы данных"
                            >
                                <div className={styles.dbIcon}>
                                    <FiDatabase />
                                </div>

                                <div className={styles.dbStatus}>
                                    <div
                                        className={`${styles.statusIndicator} ${dbStatus?.isRemote ? styles.online : styles.offline}`}
                                    >
                                        <div className={styles.statusDot}></div>
                                        <span>{dbStatus?.isRemote ? 'Онлайн' : 'Оффлайн'}</span>
                                    </div>
                                </div>
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content align="end">
                            {dbStatus?.isRemote ? (
                                <DropdownMenu.Item
                                    onSelect={() => switchDbMode('local')}
                                    disabled={isDbSwitching}
                                >
                                    Перейти в оффлайн базу
                                </DropdownMenu.Item>
                            ) : (
                                <DropdownMenu.Item
                                    onSelect={() => switchDbMode('remote')}
                                    disabled={isDbSwitching || !dbStatus?.remoteAvailable}
                                >
                                    Попробовать подключиться к удаленной базе
                                </DropdownMenu.Item>
                            )}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        <div className={styles.profile} role="button" tabIndex={0}>
                            <div className={styles.profileMeta}>
                                <div className={styles.profileName}>{user?.employee?.fio || '—'}</div>
                                <div className={styles.profileRole}>
                                    {user?.roles?.includes('director') ? 'Директор' : 'Профиль'}
                                </div>
                            </div>
                        </div>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Content align="end" className={styles.profileMenuContent}>
                        <DropdownMenu.Item
                            onSelect={async (e) => {
                                e?.preventDefault?.();
                                if (!user?.employee?.id) return;
                                await router.push(`/managers/${user.employee.id}?mode=profile`);
                            }}
                        >
                            Профиль
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator />
                        <DropdownMenu.Sub>
                            <DropdownMenu.SubTrigger>
                                Тема
                            </DropdownMenu.SubTrigger>
                            <DropdownMenu.SubContent className={styles.profileMenuContent}>
                                <DropdownMenu.RadioGroup value={user?.preferences?.theme === 'dark' ? 'dark' : 'light'}>
                                    <DropdownMenu.RadioItem
                                        value="light"
                                        onSelect={async () => {
                                            await setTheme('light');
                                        }}
                                    >
                                        Светлая
                                    </DropdownMenu.RadioItem>
                                    <DropdownMenu.RadioItem
                                        value="dark"
                                        onSelect={async () => {
                                            await setTheme('dark');
                                        }}
                                    >
                                        Тёмная
                                    </DropdownMenu.RadioItem>
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.SubContent>
                        </DropdownMenu.Sub>

                        {user?.roles?.includes('director') ? (
                            <>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item
                                    onSelect={async (e) => {
                                        e?.preventDefault?.();
                                        await router.push('/admin/finance');
                                    }}
                                >
                                    Финансы
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    onSelect={async (e) => {
                                        e?.preventDefault?.();
                                        await router.push('/admin');
                                    }}
                                >
                                    Администрирование
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    onSelect={async (e) => {
                                        e?.preventDefault?.();
                                        await router.push('/admin/audit');
                                    }}
                                >
                                    Аудит-лог
                                </DropdownMenu.Item>
                            </>
                        ) : null}

                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                            onSelect={async (e) => {
                                e?.preventDefault?.();
                                await logout();
                                await router.push('/login');
                            }}
                        >
                            Выйти
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        </header>
    );
}
