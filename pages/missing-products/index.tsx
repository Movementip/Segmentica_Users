import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import styles from './MissingProducts.module.css';
import { EditMissingProductModal } from '../../components/EditMissingProductModal';
import { AddMissingProductModal } from '../../components/AddMissingProductModal';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Box, Button, Dialog, DropdownMenu, Flex, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiAlertTriangle, FiEdit2, FiFilter, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiShoppingCart, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';

interface MissingProduct {
    id: number;
    заявка_id: number;
    товар_id: number;
    необходимое_количество: number;
    недостающее_количество: number;
    статус: string;
    товар_название?: string;
    товар_артикул?: string;
    created_at?: string;
}

interface Product {
    id: number;
    название: string;
    артикул: string;
}

interface Order {
    id: number;
}

function MissingProductsPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const filtersDropdownRef = useRef<HTMLDivElement | null>(null);
    const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const lastSyncedQueryRef = useRef<string>('');
    const lastAppliedRouterQueryRef = useRef<string>('');
    const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<MissingProduct | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);
    const [orderQuery, setOrderQuery] = useState('');
    const [productQuery, setProductQuery] = useState('');
    const [filters, setFilters] = useState({
        status: 'all',
        orderId: 'all',
        productId: 'all',
        sortBy: 'missing_desc',
        orderName: '',
        productName: '',
    });

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingProduct, setDeletingProduct] = useState<MissingProduct | null>(null);

    const syncMissingProductsUrl = (next: { q: string; status: string; orderId: string; productId: string; sort: string }) => {
        const query = { ...router.query } as Record<string, any>;

        if ((next.q || '').trim()) query.q = String(next.q).trim();
        else delete query.q;

        if (next.status && next.status !== 'all') query.status = String(next.status);
        else delete query.status;

        if (next.orderId && next.orderId !== 'all') query.orderId = String(next.orderId);
        else delete query.orderId;

        if (next.productId && next.productId !== 'all') query.productId = String(next.productId);
        else delete query.productId;

        if (next.sort && next.sort !== 'missing_desc') query.sort = String(next.sort);
        else delete query.sort;

        router.replace(
            {
                pathname: router.pathname,
                query,
            },
            undefined,
            { shallow: true }
        );
    };

    const normalize = (v: string) => (v || '').trim().toLowerCase();

    const canList = Boolean(user?.permissions?.includes('missing_products.list'));
    const canCreate = Boolean(user?.permissions?.includes('missing_products.create'));
    const canEdit = Boolean(user?.permissions?.includes('missing_products.edit'));
    const canDelete = Boolean(user?.permissions?.includes('missing_products.delete'));
    const canMissingProductsOrderView = Boolean(user?.permissions?.includes('missing_products.order.view'));
    const canOrdersView = Boolean(user?.permissions?.includes('orders.view'));
    const canOrdersList = Boolean(user?.permissions?.includes('orders.list'));
    const canProductsList = Boolean(user?.permissions?.includes('products.list'));

    const canGoToOrder = canOrdersView && canMissingProductsOrderView;
    const hasRowActions = canEdit || canGoToOrder || canDelete;

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify(router.query);
        if (signature === lastAppliedRouterQueryRef.current) return;
        lastAppliedRouterQueryRef.current = signature;

        const qRaw = router.query.q;
        const statusRaw = router.query.status;
        const orderIdRaw = router.query.orderId;
        const productIdRaw = router.query.productId;
        const sortRaw = router.query.sort;

        const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
        const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const orderId = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
        const productId = Array.isArray(productIdRaw) ? productIdRaw[0] : productIdRaw;
        const sort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        const nextQ = q !== undefined ? String(q) : '';
        const nextStatus = status ? String(status) : 'all';
        const nextOrderId = orderId ? String(orderId) : 'all';
        const nextProductId = productId ? String(productId) : 'all';
        const nextSort = sort ? String(sort) : 'missing_desc';

        setSearchTerm(nextQ);
        setFilters((prev) => ({
            ...prev,
            status: nextStatus,
            orderId: nextOrderId,
            productId: nextProductId,
            sortBy: nextSort,
        }));

        const nextSignature = JSON.stringify({ q: nextQ, status: nextStatus, orderId: nextOrderId, productId: nextProductId, sort: nextSort });
        lastSyncedQueryRef.current = nextSignature;
    }, [router.isReady, router.query]);

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify({
            q: searchTerm,
            status: filters.status,
            orderId: filters.orderId,
            productId: filters.productId,
            sort: filters.sortBy,
        });

        if (signature === lastSyncedQueryRef.current) return;
        lastSyncedQueryRef.current = signature;

        syncMissingProductsUrl({
            q: searchTerm,
            status: filters.status,
            orderId: filters.orderId,
            productId: filters.productId,
            sort: filters.sortBy,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, searchTerm, filters.status, filters.orderId, filters.productId, filters.sortBy]);
    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;

        fetchMissingProducts();

        if (canProductsList) {
            fetchProducts();
        } else {
            setProducts([]);
        }

        if (canOrdersList) {
            fetchOrders();
        } else {
            setOrders([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canList, canOrdersList, canProductsList]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const orderIdFilter = useMemo(() => {
        const raw = router.query.orderId;
        if (!raw) return null;
        const value = Array.isArray(raw) ? raw[0] : raw;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [router.query.orderId]);

    const visibleMissingProducts = useMemo(() => {
        if (!orderIdFilter) return missingProducts;
        return missingProducts.filter((p) => p.заявка_id === orderIdFilter);
    }, [missingProducts, orderIdFilter]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (isStatusSelectOpen) return;

            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget) || path.includes(filterTriggerRef.current as unknown as EventTarget)
                : Boolean(
                    (event.target as Node | null) &&
                    (filtersDropdownRef.current?.contains(event.target as Node) || filterTriggerRef.current?.contains(event.target as Node))
                );

            if (isInsideDropdown) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-missing-products-status-select-content')) return true;
                return Boolean(
                    node.closest('[data-missing-products-status-select-content]') ||
                    node.closest('.rt-SelectContent') ||
                    node.closest('[data-radix-select-content]')
                );
            });

            if (isInSelectPortal) return;

            setIsFiltersOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFiltersOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isFiltersOpen, isStatusSelectOpen]);

    const filteredOrderOptions = useMemo(() => {
        const query = orderQuery.trim().toLowerCase();
        if (!query) return orders;
        return orders.filter((order) => `заявка #${order.id}`.toLowerCase().includes(query) || String(order.id).includes(query));
    }, [orders, orderQuery]);

    const filteredProductOptions = useMemo(() => {
        const query = productQuery.trim().toLowerCase();
        if (!query) return products;
        return products.filter((product) => {
            const title = product.название?.toLowerCase() || '';
            const article = product.артикул?.toLowerCase() || '';
            return title.includes(query) || article.includes(query) || String(product.id).includes(query);
        });
    }, [products, productQuery]);

    const filteredMissingProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const baseFiltered = visibleMissingProducts.filter((product) => {
            const name = product.товар_название?.toLowerCase() || '';
            const article = product.товар_артикул?.toLowerCase() || '';
            const order = `заявка #${product.заявка_id}`.toLowerCase();

            if (filters.status !== 'all' && normalize(product.статус) !== normalize(filters.status)) {
                return false;
            }

            if (filters.orderId !== 'all' && String(product.заявка_id) !== filters.orderId) {
                return false;
            }

            if (filters.productId !== 'all' && String(product.товар_id) !== filters.productId) {
                return false;
            }

            if (!query) {
                return true;
            }

            return name.includes(query) || article.includes(query) || order.includes(query) || String(product.id).includes(query);
        });

        const sorted = [...baseFiltered];

        sorted.sort((a, b) => {
            switch (filters.sortBy) {
                case 'missing_asc':
                    return a.недостающее_количество - b.недостающее_количество;
                case 'required_desc':
                    return b.необходимое_количество - a.необходимое_количество;
                case 'required_asc':
                    return a.необходимое_количество - b.необходимое_количество;
                case 'status':
                    return a.статус.localeCompare(b.статус, 'ru');
                case 'product':
                    return (a.товар_название || '').localeCompare(b.товар_название || '', 'ru');
                case 'order':
                    return a.заявка_id - b.заявка_id;
                case 'missing_desc':
                default:
                    return b.недостающее_количество - a.недостающее_количество;
            }
        });

        return sorted;
    }, [filters.orderId, filters.productId, filters.sortBy, filters.status, searchTerm, visibleMissingProducts]);

    const summary = useMemo(() => {
        const totalMissing = visibleMissingProducts.length;
        const criticalCount = visibleMissingProducts.filter((item) => item.недостающее_количество >= item.необходимое_количество).length;
        const processingCount = visibleMissingProducts.filter((item) => item.статус === 'в обработке').length;
        const orderedCount = visibleMissingProducts.filter((item) => item.статус === 'заказано').length;
        const totalUnitsMissing = visibleMissingProducts.reduce((sum, item) => sum + item.недостающее_количество, 0);

        return {
            totalMissing,
            criticalCount,
            processingCount,
            orderedCount,
            totalUnitsMissing,
        };
    }, [visibleMissingProducts]);

    const fetchMissingProducts = async () => {
        try {
            setError(null);

            if (!canList) {
                setMissingProducts([]);
                return;
            }

            if (missingProducts.length === 0) {
                setLoading(true);
            } else {
                setIsRefreshing(true);
            }

            const response = await fetch('/api/missing-products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки недостающих товаров');
            }

            const data = await response.json();
            setMissingProducts(data);
            setRefreshTick((value) => value + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const fetchProducts = async () => {
        try {
            if (!canProductsList) {
                setProducts([]);
                return;
            }
            const response = await fetch('/api/products');

            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            setProducts(data);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    const fetchOrders = async () => {
        try {
            if (!canOrdersList) {
                setOrders([]);
                return;
            }
            const response = await fetch('/api/orders');

            if (!response.ok) {
                throw new Error('Ошибка загрузки заявок');
            }

            const data = await response.json();
            setOrders(data);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'в обработке': return 'В ОБРАБОТКЕ';
            case 'заказано': return 'ЗАКАЗАНО';
            case 'получено': return 'ПОЛУЧЕНО';
            default: return status.toUpperCase();
        }
    };

    const getStatusTone = (status: string): 'blue' | 'amber' | 'green' | 'gray' => {
        switch (status) {
            case 'в обработке': return 'blue';
            case 'заказано': return 'amber';
            case 'получено': return 'green';
            default: return 'gray';
        }
    };

    const getStatusColor = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'новая':
                return '#1976d2';
            case 'в обработке':
                return '#ef6c00';
            case 'подтверждена':
                return '#7b1fa2';
            case 'в работе':
                return '#0288d1';
            case 'собрана':
                return '#6a1b9a';
            case 'выполнена':
            case 'получено':
                return '#388e3c';
            case 'отгружена':
            case 'заказано':
                return '#0f766e';
            case 'отменена':
                return '#d32f2f';
            default:
                return '#616161';
        }
    };

    const getDeficitPercentage = (product: MissingProduct) => {
        if (!product.необходимое_количество || product.необходимое_количество <= 0) {
            return 0;
        }

        return Math.min(100, Math.round((product.недостающее_количество / product.необходимое_количество) * 100));
    };

    const getUrgencyText = (product: MissingProduct) => {
        if (product.недостающее_количество >= product.необходимое_количество) {
            return 'Критично';
        }

        const ratio = product.недостающее_количество / product.необходимое_количество;

        if (ratio >= 0.6) return 'Высокая';
        if (ratio >= 0.3) return 'Средняя';
        return 'Низкая';
    };

    const getUrgencyClassName = (product: MissingProduct) => {
        if (product.недостающее_количество >= product.необходимое_количество) {
            return styles.urgencyCritical;
        }

        const ratio = product.недостающее_количество / product.необходимое_количество;

        if (ratio >= 0.6) return styles.urgencyHigh;
        if (ratio >= 0.3) return styles.urgencyMedium;
        return styles.urgencyLow;
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            const response = await fetch('/api/missing-products', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, статус: status }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления статуса');
            }

            // Refresh the list
            fetchMissingProducts();

            alert('Статус успешно обновлен');
        } catch (error) {
            alert(`Ошибка при обновлении статуса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        }
    };

    const handleOpenDelete = (product: MissingProduct) => {
        if (!canDelete) return;
        setDeletingProduct(product);
        setDeleteError(null);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingProduct) return;
        if (!canDelete) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(`/api/missing-products?id=${deletingProduct.id}`, {
                method: 'DELETE',
            });

            const errorData = await response.json().catch(() => ({} as any));

            if (!response.ok) {
                throw new Error(errorData?.error || 'Ошибка удаления недостающего товара');
            }

            await fetchMissingProducts();
            setIsDeleteDialogOpen(false);
            setDeletingProduct(null);
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            setIsDeleting(false);
        }
    };

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.errorState}>
                        <Text as="div" size="4" weight="bold">Ошибка загрузки</Text>
                        <Text as="div" size="2" color="red">{error}</Text>
                        <Button onClick={fetchMissingProducts}>Повторить попытку</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageShell}>
                <div className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <Text size="7" weight="bold" className={styles.pageTitle}>Недостающие товары</Text>
                        <Text as="p" size="2" color="gray" className={styles.pageDescription}>
                            Товары с недостаточным остатком, требующие пополнения или обработки по заявкам.
                        </Text>
                        {orderIdFilter ? (
                            <Text as="p" size="2" color="gray" className={styles.pageDescription}>
                                Активен фильтр по заявке #{orderIdFilter}.
                            </Text>
                        ) : null}
                    </div>

                    <div className={styles.pageActions}>
                        <Button
                            variant="surface"
                            color="gray"
                            highContrast
                            onClick={(e) => {
                                e.currentTarget.blur();
                                if (isRefreshing) return;
                                setIsRefreshing(true);
                                setMinRefreshSpinActive(true);
                                setRefreshClickKey((value) => value + 1);
                                fetchMissingProducts();
                            }}

                            className={styles.surfaceButton}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                size={14}
                                className={(isRefreshing || minRefreshSpinActive) ? styles.spin : undefined}
                            />{' '}
                            Обновить
                        </Button>

                        {canCreate ? (
                            <Button onClick={() => setShowAddModal(true)} className={styles.primaryButton}>
                                <FiPlus size={14} /> Добавить недостающий товар
                            </Button>
                        ) : null}
                    </div>
                </div>

                {summary.criticalCount > 0 ? (
                    <div className={styles.alertBanner}>
                        <div className={styles.alertContent}>
                            <FiAlertTriangle size={18} />
                            <div>
                                <Text as="div" size="3" weight="bold" className={styles.alertTitle}>Критическое внимание</Text>
                                <Text as="div" size="2" color="red">
                                    {summary.criticalCount} {summary.criticalCount === 1 ? 'позиция требует' : 'позиции требуют'} срочного пополнения.
                                </Text>
                            </div>
                        </div>

                    </div>
                ) : null}

                <div className={styles.tableCard}>
                    <div className={styles.statsContainer}>
                        <h2 className={styles.statsTitle}>Статистика недостающих товаров</h2>
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.new}`}>{summary.totalMissing}</div>
                                <div className={styles.statLabel}>Всего позиций</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.inProgress}`}>{summary.criticalCount}</div>
                                <div className={styles.statLabel}>Критичных</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.completed}`}>{summary.totalUnitsMissing}</div>
                                <div className={styles.statLabel}>Недостаёт единиц</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.total}`}>{summary.processingCount + summary.orderedCount}</div>
                                <div className={styles.statLabel}>В работе / заказано</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.searchSection}>
                        <TextField.Root
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Поиск по товару, артикулу или заявке..."
                            className={styles.searchInput}
                            size="3"
                            radius="large"
                            variant="surface"
                        >
                            <TextField.Slot side="left">
                                <FiSearch size={16} className={styles.searchIcon} />
                            </TextField.Slot>
                        </TextField.Root>

                        <div className={styles.filterGroup}>
                            <div className={styles.filterDropdown} ref={filtersDropdownRef}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.filterSelectTrigger}
                                    ref={filterTriggerRef}
                                    onClick={() => setIsFiltersOpen((value) => !value)}
                                    aria-expanded={isFiltersOpen}
                                >
                                    <span className={styles.triggerLabel}>
                                        <FiFilter className={styles.icon} />
                                        Фильтры
                                    </span>
                                </Button>

                                {isFiltersOpen ? (
                                    <Box className={styles.filtersDropdownPanel}>
                                        <Tabs.Root defaultValue="status">
                                            <Tabs.List className={styles.filtersTabs}>
                                                <Tabs.Trigger value="status">Статус</Tabs.Trigger>
                                                <Tabs.Trigger value="order">Заявка</Tabs.Trigger>
                                                <Tabs.Trigger value="product">Товар</Tabs.Trigger>
                                            </Tabs.List>

                                            <Box pt="3">
                                                <Tabs.Content value="status">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Статус</Text>
                                                        <Select.Root
                                                            value={filters.status}
                                                            onOpenChange={setIsStatusSelectOpen}
                                                            onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                                                        >
                                                            <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                            <Select.Content
                                                                data-missing-products-status-select-content
                                                                position="popper"
                                                                variant="solid"
                                                                color="gray"
                                                                highContrast
                                                            >
                                                                <Select.Item value="all">Все статусы</Select.Item>
                                                                <Select.Item value="в обработке">В обработке</Select.Item>
                                                                <Select.Item value="заказано">Заказано</Select.Item>
                                                                <Select.Item value="получено">Получено</Select.Item>
                                                            </Select.Content>
                                                        </Select.Root>
                                                    </Box>
                                                </Tabs.Content>

                                                <Tabs.Content value="order">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Заявка</Text>
                                                        <TextArea
                                                            size="2"
                                                            variant="surface"
                                                            resize="none"
                                                            radius="large"
                                                            placeholder="Начни вводить номер заявки…"
                                                            value={orderQuery}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setOrderQuery(value);
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    orderName: value,
                                                                    orderId: value.trim() ? prev.orderId : 'all',
                                                                }));
                                                            }}
                                                            className={styles.filterTextArea}
                                                        />
                                                        {orderQuery.trim() ? (
                                                            <div className={styles.inlineSuggestList}>
                                                                {filteredOrderOptions.length === 0 ? (
                                                                    <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                                ) : (
                                                                    filteredOrderOptions.slice(0, 10).map((order) => (
                                                                        <button
                                                                            key={order.id}
                                                                            type="button"
                                                                            className={styles.inlineSuggestItem}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                setOrderQuery(`Заявка #${order.id}`);
                                                                                setFilters((prev) => ({ ...prev, orderId: String(order.id), orderName: `Заявка #${order.id}` }));
                                                                            }}
                                                                        >
                                                                            Заявка #{order.id}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </Box>
                                                </Tabs.Content>

                                                <Tabs.Content value="product">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Товар</Text>
                                                        <TextArea
                                                            size="2"
                                                            variant="surface"
                                                            resize="none"
                                                            radius="large"
                                                            placeholder="Начни вводить товар или артикул…"
                                                            value={productQuery}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setProductQuery(value);
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    productName: value,
                                                                    productId: value.trim() ? prev.productId : 'all',
                                                                }));
                                                            }}
                                                            className={styles.filterTextArea}
                                                        />
                                                        {productQuery.trim() ? (
                                                            <div className={styles.inlineSuggestList}>
                                                                {filteredProductOptions.length === 0 ? (
                                                                    <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                                ) : (
                                                                    filteredProductOptions.slice(0, 10).map((product) => (
                                                                        <button
                                                                            key={product.id}
                                                                            type="button"
                                                                            className={styles.inlineSuggestItem}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                setProductQuery(`${product.артикул} - ${product.название}`);
                                                                                setFilters((prev) => ({
                                                                                    ...prev,
                                                                                    productId: String(product.id),
                                                                                    productName: `${product.артикул} - ${product.название}`,
                                                                                }));
                                                                            }}
                                                                        >
                                                                            {product.артикул} - {product.название}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </Box>
                                                </Tabs.Content>
                                            </Box>
                                        </Tabs.Root>

                                        <Flex justify="between" gap="3" className={styles.filtersDropdownPanelActions}>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => {
                                                    setOrderQuery('');
                                                    setProductQuery('');
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        status: 'all',
                                                        orderId: 'all',
                                                        productId: 'all',
                                                        orderName: '',
                                                        productName: '',
                                                    }));
                                                }}
                                            >
                                                Сбросить
                                            </Button>
                                            <Button type="button" onClick={() => setIsFiltersOpen(false)}>
                                                Применить
                                            </Button>
                                        </Flex>
                                    </Box>
                                ) : null}
                            </div>

                            <div className={styles.sortDropdown}>
                                <span>Сортировка: </span>
                                <Select.Root
                                    value={filters.sortBy}
                                    onValueChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value }))}
                                >
                                    <Select.Trigger className={styles.sortSelectTrigger} />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="missing_desc">По недостаче (убыв.)</Select.Item>
                                        <Select.Item value="missing_asc">По недостаче (возр.)</Select.Item>
                                        <Select.Item value="required_desc">По требуемому (убыв.)</Select.Item>
                                        <Select.Item value="required_asc">По требуемому (возр.)</Select.Item>
                                        <Select.Item value="status">По статусу</Select.Item>
                                        <Select.Item value="product">По товару</Select.Item>
                                        <Select.Item value="order">По заявке</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                    </div>



                    {loading ? (
                        <div className={styles.tableContainer} key={refreshTick}>
                            <PageLoader label="Загрузка недостающих товаров..." />
                        </div>
                    ) : (
                    <div className={styles.tableContainer} key={refreshTick}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell align="right">Необходимо</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell align="right">Недостаёт</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell align="right">Дефицит</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {filteredMissingProducts.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={8}>
                                            <div className={styles.emptyState}>Недостающие товары не найдены.</div>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    filteredMissingProducts.map((product, index) => (
                                        <Table.Row
                                            key={`${product.id}-${refreshTick}`}
                                            className={styles.tableRow}
                                            style={{ animationDelay: `${index * 0.03}s` }}
                                        >
                                            <Table.Cell className={styles.tableCell}>
                                                <span className={styles.orderId}>#{product.id}</span>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <span className={styles.orderId}>
                                                    Заявка #{product.заявка_id}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div className={styles.itemTitle}>{product.товар_название || `Товар #${product.товар_id}`}</div>
                                                <div className={styles.itemSub}>{product.товар_артикул || 'Артикул не указан'}</div>
                                            </Table.Cell>
                                            <Table.Cell align="right" className={styles.tableCell}>{product.необходимое_количество}</Table.Cell>
                                            <Table.Cell align="right" className={styles.tableCell}>
                                                <span className={styles.missingQty}>{product.недостающее_количество}</span>
                                            </Table.Cell>
                                            <Table.Cell align="right" className={styles.tableCell}>
                                                <span className={styles.percentValue}>{getDeficitPercentage(product)}%</span>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div
                                                    className={styles.statusBadge}
                                                    style={{
                                                        backgroundColor: `${getStatusColor(product.статус)}15`,
                                                        color: getStatusColor(product.статус),
                                                        border: `1px solid ${getStatusColor(product.статус)}40`
                                                    }}
                                                >
                                                    {getStatusText(product.статус)}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                {hasRowActions ? (
                                                    <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu.Root>
                                                            <DropdownMenu.Trigger>
                                                                <button
                                                                    type="button"
                                                                    className={styles.menuButton}
                                                                    aria-label="Меню"
                                                                    title="Действия"
                                                                >
                                                                    <FiMoreHorizontal size={18} />
                                                                </button>
                                                            </DropdownMenu.Trigger>
                                                            <DropdownMenu.Content align="end" sideOffset={6}>
                                                                {canEdit ? (
                                                                    <DropdownMenu.Item onSelect={(e) => {
                                                                        e?.preventDefault?.();
                                                                        setEditingProduct(product);
                                                                        setShowEditModal(true);
                                                                    }}>
                                                                        <FiEdit2 className={styles.rowMenuIcon} />
                                                                        Редактировать
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canGoToOrder ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            router.push(`/orders/${product.заявка_id}`);
                                                                        }}
                                                                    >
                                                                        <FiShoppingCart className={styles.rowMenuIcon} />
                                                                        Перейти к заявке
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canGoToOrder && canDelete ? <DropdownMenu.Separator /> : null}
                                                                {canDelete ? (
                                                                    <DropdownMenu.Item color="red" className={styles.rowMenuItemDanger} onSelect={(e) => {
                                                                        e?.preventDefault?.();
                                                                        handleOpenDelete(product);
                                                                    }}>
                                                                        <FiTrash2 className={styles.rowMenuIconDel} />
                                                                        Удалить
                                                                    </DropdownMenu.Item>
                                                                ) : null}
                                                            </DropdownMenu.Content>
                                                        </DropdownMenu.Root>
                                                    </div>
                                                ) : null}
                                            </Table.Cell>
                                        </Table.Row>
                                    ))
                                )}
                            </Table.Body>
                        </Table.Root>
                    </div>
                    )}
                </div>
            </div>

            {canCreate ? (
                <AddMissingProductModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onCreated={async () => {
                        await fetchMissingProducts();
                    }}
                    products={products}
                    orders={orders}
                />
            ) : null}

            {canEdit ? (
                <EditMissingProductModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingProduct(null);
                    }}
                    onUpdated={() => {
                        setShowEditModal(false);
                        setEditingProduct(null);
                        fetchMissingProducts();
                    }}
                    missingProduct={editingProduct}
                    products={products}
                    orders={orders}
                />
            ) : null}

            <Dialog.Root
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDeleteDialogOpen(false);
                        setDeletingProduct(null);
                        setDeleteError(null);
                    }
                }}
            >
                <Dialog.Content className={deleteConfirmStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить этот недостающий товар?
                            </Text>

                            {deletingProduct ? (
                                <Box className={deleteConfirmStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">Позиция #{deletingProduct.id}</Text>
                                        <Text as="div" size="2" color="gray">Заявка: #{deletingProduct.заявка_id}</Text>
                                        <Text as="div" size="2" color="gray">Товар: {deletingProduct.товар_название || `#${deletingProduct.товар_id}`}</Text>
                                    </Flex>
                                </Box>
                            ) : null}

                            <Text as="div" size="2" color="gray">
                                <Text as="span" weight="bold">Внимание:</Text> Это действие нельзя отменить.
                            </Text>

                            {deleteError ? (
                                <Box mt="3">
                                    <Text as="div" color="red" size="2">
                                        {deleteError}
                                    </Text>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmStyles.modalDeleteButton}
                                    onClick={handleDeleteConfirm}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(MissingProductsPage);
