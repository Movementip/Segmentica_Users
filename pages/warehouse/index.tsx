import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../layout/Layout';
import { CreateProductModal } from '../../components/CreateProductModal';
import { EditProductModal } from '../../components/EditProductModal';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import { AdjustStockModal } from '../../components/AdjustStockModal';
import { WarehouseMovementModal } from '../../components/WarehouseMovementModal';
import styles from './Warehouse.module.css';
import * as XLSX from 'xlsx';
import { FiDownload, FiMoreHorizontal, FiPlus, FiSearch, FiTruck, FiAlertTriangle, FiArrowUpRight, FiArrowDownLeft, FiPackage, FiBarChart2, FiEdit2, FiEye, FiSliders, FiTrash2, FiUpload } from 'react-icons/fi';
import { Badge, Box, Button, Dialog, DropdownMenu, Flex, Table, Text, TextField, Select, Card, Tabs } from '@radix-ui/themes';
import { WarehouseData, WarehouseItem } from './types';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

const MotionTableRow = motion(Table.Row);

export default function Warehouse() {
    const { user, loading: authLoading } = useAuth();
    const [data, setData] = useState<WarehouseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [filter, setFilter] = useState<'all' | 'critical' | 'low' | 'normal'>('all');
    const [category, setCategory] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<WarehouseItem | null>(null);
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementModalInitialType, setMovementModalInitialType] = useState<'приход' | 'расход'>('приход');
    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'critical'>('stock');
    const [attachmentsTypesByProductId, setAttachmentsTypesByProductId] = useState<Record<number, string[]>>({});
    const tabsListRef = useRef<HTMLDivElement | null>(null);
    const [tabsIndicatorStyle, setTabsIndicatorStyle] = useState<React.CSSProperties>({
        transform: 'translateX(0px)',
        width: 0,
        opacity: 0,
    });
    const [isTabsIndicatorReady, setIsTabsIndicatorReady] = useState(false);
    const router = useRouter();

    const canList = Boolean(user?.permissions?.includes('warehouse.list'));
    const canView = Boolean(user?.permissions?.includes('warehouse.view'));
    const canProductCreate = Boolean(user?.permissions?.includes('products.create'));
    const canWarehouseCreate = Boolean(user?.permissions?.includes('warehouse.create'));
    const canCreate = canProductCreate && canWarehouseCreate;
    const canEdit = Boolean(user?.permissions?.includes('warehouse.edit'));
    const canDelete = Boolean(user?.permissions?.includes('warehouse.delete'));
    const canMovementCreate = Boolean(user?.permissions?.includes('warehouse.movement.create'));
    const canStockAdjust = Boolean(user?.permissions?.includes('warehouse.stock.adjust'));
    const canMovementsView = Boolean(user?.permissions?.includes('warehouse.movements.view'));
    const canCriticalView = Boolean(user?.permissions?.includes('warehouse.critical.view'));
    const canExportExcel = Boolean(user?.permissions?.includes('warehouse.export.excel'));
    const canImportExcel = Boolean(user?.permissions?.includes('warehouse.import.excel'));
    const canWarehouseProductAttachmentsView =
        Boolean(user?.permissions?.includes('warehouse-products.attachments.view'));

    useEffect(() => {
        if (authLoading) return;
        if (activeTab === 'movements' && !canMovementsView) setActiveTab('stock');
        if (activeTab === 'critical' && !canCriticalView) setActiveTab('stock');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, authLoading, canCriticalView, canMovementsView]);

    const syncTabsIndicator = () => {
        const list = tabsListRef.current;
        if (!list) return;

        const active = list.querySelector('[data-state="active"]') as HTMLElement | null;
        if (!active) return;

        const listRect = list.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const listStyle = window.getComputedStyle(list);
        const padLeft = Number.parseFloat(listStyle.paddingLeft || '0') || 0;
        const left = activeRect.left - listRect.left - padLeft;
        const width = activeRect.width;

        setTabsIndicatorStyle({
            transform: `translateX(${Math.max(0, left)}px)`,
            width,
            opacity: 1,
        });
        setIsTabsIndicatorReady(true);
    };

    const handleImportExcelFile = async (file: File) => {
        if (!canImportExcel) return;
        if (!file) return;

        setIsImportingExcel(true);

        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array' });
            const wsName = wb.SheetNames?.[0];
            if (!wsName) throw new Error('Файл Excel пуст');
            const ws = wb.Sheets[wsName];
            const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];

            const normalizedRows = rawRows
                .map((r) => {
                    const pick = (keys: string[]) => {
                        for (const k of keys) {
                            if (r[k] != null && String(r[k]).trim() !== '') return r[k];
                        }
                        return '';
                    };

                    return {
                        артикул: String(pick(['Артикул', 'артикул', 'SKU', 'sku'])).trim(),
                        название: String(pick(['Название', 'название', 'Товар', 'товар'])).trim(),
                        категория: String(pick(['Категория', 'категория'])).trim() || null,
                        единица_измерения: String(pick(['Ед. измерения', 'Ед измерения', 'Единица', 'единица_измерения', 'единица'])).trim(),
                        минимальный_остаток: pick(['Мин. остаток', 'Мин остаток', 'минимальный_остаток']),
                        цена_закупки: pick(['Цена закупки', 'цена_закупки']),
                        цена_продажи: pick(['Цена продажи', 'цена_продажи']),
                        количество: pick(['Количество', 'количество', 'Остаток', 'остаток']),
                    };
                })
                .filter((r) => r.артикул || r.название);

            if (normalizedRows.length === 0) {
                throw new Error('Не удалось найти строки для импорта');
            }

            const res = await fetch('/api/warehouse/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: normalizedRows }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Ошибка импорта');
            }

            await fetchData();
            alert('Импорт выполнен');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Ошибка импорта';
            alert(msg);
        } finally {
            setIsImportingExcel(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    useLayoutEffect(() => {
        let id2 = 0;
        const id1 = window.requestAnimationFrame(() => {
            id2 = window.requestAnimationFrame(() => syncTabsIndicator());
        });
        const t = window.setTimeout(() => syncTabsIndicator(), 120);
        return () => {
            window.cancelAnimationFrame(id1);
            if (id2) window.cancelAnimationFrame(id2);
            window.clearTimeout(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        if (!router.isReady) return;
        const id = window.requestAnimationFrame(() => syncTabsIndicator());
        return () => window.cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        const list = tabsListRef.current;
        if (!list) return;

        const ro = new ResizeObserver(() => syncTabsIndicator());
        ro.observe(list);

        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onResize = () => syncTabsIndicator();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canList]);

    useEffect(() => {
        if (!router.isReady) return;

        const q = router.query;
        const nextTab = (Array.isArray(q.tab) ? q.tab[0] : q.tab) as typeof activeTab | undefined;
        const nextSearch = Array.isArray(q.search) ? q.search[0] : q.search;
        const nextCategory = Array.isArray(q.category) ? q.category[0] : q.category;
        const nextFilter = (Array.isArray(q.filter) ? q.filter[0] : q.filter) as typeof filter | undefined;

        if (nextTab === 'stock' || nextTab === 'movements' || nextTab === 'critical') {
            setActiveTab(nextTab);
        }
        if (typeof nextSearch === 'string') {
            setSearch(nextSearch);
            setDebouncedSearch(nextSearch);
        }
        if (typeof nextCategory === 'string') setCategory(nextCategory);
        if (nextFilter === 'all' || nextFilter === 'critical' || nextFilter === 'low' || nextFilter === 'normal') {
            setFilter(nextFilter);
        }
        // only restore once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), 250);
        return () => window.clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (!router.isReady) return;

        const query: Record<string, string> = {};

        if (activeTab !== 'stock') query.tab = activeTab;
        if (debouncedSearch.trim()) query.search = debouncedSearch;
        if (category !== 'all') query.category = category;
        if (activeTab === 'stock' && filter !== 'all') query.filter = filter;

        const currentQuery = router.query;
        const currentTab = Array.isArray(currentQuery.tab) ? currentQuery.tab[0] : currentQuery.tab;
        const currentSearch = Array.isArray(currentQuery.search) ? currentQuery.search[0] : currentQuery.search;
        const currentCategory = Array.isArray(currentQuery.category) ? currentQuery.category[0] : currentQuery.category;
        const currentFilter = Array.isArray(currentQuery.filter) ? currentQuery.filter[0] : currentQuery.filter;

        const nextTab = query.tab || undefined;
        const nextSearch = query.search || undefined;
        const nextCategory = query.category || undefined;
        const nextFilter = query.filter || undefined;

        const unchanged =
            String(currentTab || '') === String(nextTab || '') &&
            String(currentSearch || '') === String(nextSearch || '') &&
            String(currentCategory || '') === String(nextCategory || '') &&
            String(currentFilter || '') === String(nextFilter || '');

        if (unchanged) return;

        router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }, [activeTab, category, debouncedSearch, filter, router, router.isReady, router.query]);

    const fetchData = async () => {
        try {
            setIsFetching(true);
            const response = await fetch('/api/warehouse');
            const result = await response.json();
            setData(result);

            const productIds = (result?.warehouse || [])
                .map((i: WarehouseItem) => Number(i.товар_id))
                .filter((n: number) => Number.isInteger(n) && n > 0);

            if (productIds.length > 0 && canWarehouseProductAttachmentsView) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=product&entity_ids=${encodeURIComponent(productIds.join(','))}&perm_scope=warehouse`
                    );
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as Array<{ entity_id: number; types: string[] }>;
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByProductId(map);
                    }
                } catch (e) {
                    console.error('Error fetching warehouse product attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByProductId({});
            }
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
        } finally {
            setIsFetching(false);
            setLoading(false);
        }
    };

    const renderAttachmentBadges = (productId: number) => {
        const types = attachmentsTypesByProductId[productId] || [];
        const normalized = Array.from(new Set(types));
        const show = normalized.filter((t) => ['pdf', 'word', 'excel', 'image', 'file'].includes(t));
        if (show.length === 0) return null;

        const badgeFor = (t: string) => {
            switch (t) {
                case 'pdf':
                    return { label: 'PDF', color: 'red' as const };
                case 'word':
                    return { label: 'WORD', color: 'blue' as const };
                case 'excel':
                    return { label: 'EXCEL', color: 'green' as const };
                case 'image':
                    return { label: 'IMG', color: 'gray' as const };
                default:
                    return { label: 'FILE', color: 'gray' as const };
            }
        };

        return (
            <Flex align="center" gap="2" wrap="wrap" style={{ marginTop: 6 }}>
                {show.map((t) => {
                    const b = badgeFor(t);
                    return (
                        <Badge key={t} color={b.color} variant="soft" highContrast>
                            {b.label}
                        </Badge>
                    );
                })}
            </Flex>
        );
    };

    const getPlural = (n: number, one: string, few: string, many: string) => {
        const abs = Math.abs(n);
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod100 >= 11 && mod100 <= 14) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    };

    const openEditModalFor = (item: WarehouseItem) => {
        if (!canEdit) return;
        setSelectedWarehouseItem(item);
        setIsEditProductModalOpen(true);
    };

    const openDeleteModalFor = (item: WarehouseItem) => {
        if (!canDelete) return;
        setSelectedWarehouseItem(item);
        setIsDeleteModalOpen(true);
    };

    const openStockAdjustmentFor = (item: WarehouseItem) => {
        if (!canEdit) return;
        setSelectedWarehouseItem(item);
        setIsAdjustStockModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedWarehouseItem) return;
        if (!canDelete) return;

        try {
            setIsDeleting(true);
            const response = await fetch(`/api/warehouse?id=${selectedWarehouseItem.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления товара');
            }

            setIsDeleteModalOpen(false);
            setSelectedWarehouseItem(null);
            fetchData();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateProduct = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleProductCreated = () => {
        fetchData();
        setIsCreateModalOpen(false);
    };

    const openItem = (item: WarehouseItem) => {
        if (!canView) return;
        router.push(`/warehouse/${item.id}`);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStockStatusColor = (status: string) => {
        switch (status) {
            case 'critical': return '#ff4444';
            case 'low': return '#ff8800';
            default: return '#4CAF50';
        }
    };

    const getStockStatusText = (status: string) => {
        switch (status) {
            case 'critical': return 'Критический';
            case 'low': return 'Низкий';
            default: return 'Нормальный';
        }
    };

    const getOperationTypeColor = (type: string) => {
        switch (type) {
            case 'поступление': return '#4CAF50';
            case 'отгрузка': return '#ff4444';
            case 'списание': return '#ff8800';
            case 'инвентаризация': return '#2196F3';
            default: return '#666';
        }
    };

    const filteredItems = useMemo(() => {
        const items = data?.warehouse || [];
        const q = debouncedSearch.trim().toLowerCase();
        return items.filter((item) => {
            const matchesSearch = !q ||
                (item.товар_название || '').toLowerCase().includes(q) ||
                (item.товар_артикул || '').toLowerCase().includes(q);

            const matchesCategory = category === 'all' || (item.товар_категория || '') === category;

            if (!matchesSearch || !matchesCategory) return false;

            if (filter === 'critical') return item.stock_status === 'critical';
            if (filter === 'low') return item.stock_status === 'low' || item.stock_status === 'critical';
            if (filter === 'normal') return item.stock_status === 'normal';
            return true;
        });
    }, [category, data?.warehouse, debouncedSearch, filter]);

    const filteredLowStock = useMemo(() => {
        const items = data?.lowStock || [];
        const q = debouncedSearch.trim().toLowerCase();
        return items.filter((item) => {
            const matchesSearch = !q ||
                (item.товар_название || '').toLowerCase().includes(q) ||
                (item.товар_артикул || '').toLowerCase().includes(q);

            const matchesCategory = category === 'all' || (item.товар_категория || '') === category;

            // critical tab is always critical/low list, but keep optional strict filter compatibility
            if (!matchesSearch || !matchesCategory) return false;

            if (filter === 'critical') return item.stock_status === 'critical';
            if (filter === 'low') return item.stock_status === 'low' || item.stock_status === 'critical';
            if (filter === 'normal') return item.stock_status === 'normal';
            return true;
        });
    }, [category, data?.lowStock, debouncedSearch, filter]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        (data?.warehouse || []).forEach((i) => {
            if (i.товар_категория) set.add(i.товар_категория);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [data?.warehouse]);

    const totalItems = data?.warehouse?.length || 0;
    const criticalCount = data?.lowStock?.length || 0;
    const totalQty = useMemo(() => {
        return (data?.warehouse || []).reduce((sum, item) => sum + (item?.количество || 0), 0);
    }, [data?.warehouse]);
    const totalValue = useMemo(() => {
        return (data?.warehouse || []).reduce((sum, item) => sum + (item?.количество || 0) * (item?.товар_цена_закупки || 0), 0);
    }, [data?.warehouse]);
    const movementsLastMonth = useMemo(() => {
        const items = data?.movements || [];
        if (!items.length) return 0;
        const now = Date.now();
        const from = now - 30 * 24 * 60 * 60 * 1000;
        return items.filter((m) => {
            const t = new Date(m.дата_операции).getTime();
            return Number.isFinite(t) && t >= from && t <= now;
        }).length;
    }, [data?.movements]);

    const getStatusBadgeClass = (status: WarehouseItem['stock_status']) => {
        if (status === 'critical') return styles.badgeCritical;
        if (status === 'low') return styles.badgeLow;
        return styles.badgeNormal;
    };

    const filteredMovements = useMemo(() => {
        const items = data?.movements || [];
        const q = debouncedSearch.trim().toLowerCase();
        return items.filter((m) => {
            if (!q) return true;
            return (m.товар_название || '').toLowerCase().includes(q) || (m.товар_артикул || '').toLowerCase().includes(q);
        });
    }, [data?.movements, debouncedSearch]);

    if (authLoading) {
        return (
            <Layout>
                <Box p="5">
                    <Text>Загрузка…</Text>
                </Box>
            </Layout>
        );
    }

    if (!canList) {
        return (
            <Layout>
                <NoAccessPage />
            </Layout>
        );
    }

    if (loading) {
        return (
            <Layout>
                <div className={styles.loading}>Загрузка...</div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout>
                <div className={styles.error}>Ошибка загрузки данных</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>Управление складом</h1>
                            <p className={styles.subtitle}>Складские остатки, движения товаров и контроль запасов</p>
                        </div>

                        <div className={styles.headerActions}>
                            {canMovementCreate ? (
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.surfaceButton}
                                    onClick={() => {
                                        setMovementModalInitialType('расход');
                                        setIsMovementModalOpen(true);
                                    }}
                                >
                                    <FiArrowUpRight size={16} /> Расход
                                </Button>
                            ) : null}

                            {canMovementCreate ? (
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.surfaceButton}
                                    onClick={() => {
                                        setMovementModalInitialType('приход');
                                        setIsMovementModalOpen(true);
                                    }}
                                >
                                    <FiArrowDownLeft size={16} /> Приход
                                </Button>
                            ) : null}

                            {canCreate ? (
                                <Button
                                    type="button"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    className={styles.primaryButton}
                                    onClick={handleCreateProduct}
                                >
                                    <FiPlus size={14} /> Добавить товар
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <Card className={styles.statsContainer}>
                        <h2 className={styles.statsTitle}>Статистика склада</h2>
                        <div className={styles.statsGridOrdersStyle}>
                            <div className={styles.statCardOrdersStyle}>
                                <div className={styles.statValueOrdersStyle}>{totalItems.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabelOrdersStyle}>Всего позиций</div>
                            </div>
                            <div className={styles.statCardOrdersStyle}>
                                <div className={styles.statValueOrdersStyle}>{criticalCount.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabelOrdersStyle}>Критический остаток</div>
                            </div>
                            <div className={styles.statCardOrdersStyle}>
                                <div className={styles.statValueOrdersStyle}>{formatCurrency(totalValue)}</div>
                                <div className={styles.statLabelOrdersStyle}>Стоимость остатков</div>
                            </div>
                            <div className={styles.statCardOrdersStyle}>
                                <div className={styles.statValueOrdersStyle}>{movementsLastMonth.toLocaleString('ru-RU')}</div>
                                <div className={styles.statLabelOrdersStyle}>Движений за месяц</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {criticalCount > 0 && canCriticalView ? (
                    <div className={styles.attentionBanner}>
                        <div className={styles.attentionLeft}>
                            <FiAlertTriangle className={styles.attentionIcon} />
                            <div>
                                <div className={styles.attentionTitle}>Требует внимания</div>
                                <div className={styles.attentionText}>
                                    {criticalCount} {getPlural(criticalCount, 'товар', 'товара', 'товаров')} {criticalCount === 1 ? 'имеет' : 'имеют'} критически низкий остаток. Рекомендуется срочное пополнение.
                                </div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={styles.surfaceButton}
                            onClick={() => {
                                setActiveTab('critical');
                                setFilter('critical');
                            }}
                        >
                            Просмотреть
                        </Button>
                    </div>
                ) : null}

                <div className={styles.tableSection}>
                    <Tabs.Root
                        value={activeTab}
                        onValueChange={(v) => {
                            const next = v as any;
                            if (next === 'movements' && !canMovementsView) return;
                            if (next === 'critical' && !canCriticalView) return;
                            setActiveTab(next);
                            if (next !== 'stock') {
                                setFilter('all');
                            }
                        }}
                    >
                        <Tabs.List className={styles.tabsList} ref={tabsListRef as any}>
                            <span
                                className={styles.tabsIndicator}
                                style={tabsIndicatorStyle}
                                data-ready={isTabsIndicatorReady ? 'true' : 'false'}
                                aria-hidden="true"
                            />
                            <Tabs.Trigger value="stock">Складские остатки</Tabs.Trigger>
                            {canMovementsView ? (
                                <Tabs.Trigger value="movements">Движения товаров</Tabs.Trigger>
                            ) : null}
                            {canCriticalView ? (
                                <Tabs.Trigger value="critical">
                                    Критические остатки
                                    {criticalCount > 0 ? (
                                        <span className={styles.tabBadge}>{criticalCount}</span>
                                    ) : null}
                                </Tabs.Trigger>
                            ) : null}
                        </Tabs.List>

                        <div className={styles.tableHeader}>
                            <TextField.Root
                                className={styles.searchInput}
                                size="3"
                                radius="large"
                                variant="surface"
                                placeholder="Поиск по названию или коду..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            >
                                <TextField.Slot side="left">
                                    <FiSearch height="16" width="16" />
                                </TextField.Slot>
                            </TextField.Root>

                            <div className={styles.tableHeaderActions}>
                                {activeTab !== 'movements' ? (
                                    <Select.Root value={category} onValueChange={(v) => setCategory(v)}>
                                        <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                        <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                            <Select.Item value="all">Все категории</Select.Item>
                                            {categories.map((c) => (
                                                <Select.Item key={c} value={c}>{c}</Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                ) : null}

                                {activeTab === 'stock' ? (
                                    <Select.Root value={filter} onValueChange={(v) => setFilter(v as any)}>
                                        <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                        <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                                            <Select.Item value="all">Все статусы</Select.Item>
                                            <Select.Item value="critical">Критический</Select.Item>
                                            <Select.Item value="low">Низкий</Select.Item>
                                            <Select.Item value="normal">Нормальный</Select.Item>
                                        </Select.Content>
                                    </Select.Root>
                                ) : null}

                                {activeTab === 'stock' && canExportExcel ? (
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="gray"
                                        highContrast
                                        className={styles.surfaceButton}
                                        onClick={() => {
                                            if (!filteredItems.length) return;

                                            const ws = XLSX.utils.json_to_sheet(filteredItems.map(item => ({
                                                'ID': item.id,
                                                'Название': item.товар_название,
                                                'Артикул': item.товар_артикул,
                                                'Категория': item.товар_категория || '',
                                                'Количество': item.количество,
                                                'Ед. измерения': item.товар_единица,
                                                'Мин. остаток': item.товар_мин_остаток,
                                                'Статус': getStockStatusText(item.stock_status),
                                                'Цена закупки': item.товар_цена_закупки || 0,
                                                'Цена продажи': item.товар_цена_продажи,
                                                'Дата последнего поступления': item.дата_последнего_поступления
                                                    ? new Date(item.дата_последнего_поступления).toLocaleDateString('ru-RU')
                                                    : 'Нет данных',
                                                'Общая стоимость': (item.количество * (item.товар_цена_закупки || 0)).toFixed(2)
                                            })));

                                            const wb = XLSX.utils.book_new();
                                            XLSX.utils.book_append_sheet(wb, ws, 'Склад');
                                            const date = new Date().toISOString().split('T')[0];
                                            XLSX.writeFile(wb, `Склад_${date}.xlsx`);
                                        }}
                                    >
                                        <FiDownload size={16} /> Excel
                                    </Button>
                                ) : null}

                                {activeTab === 'stock' && canImportExcel ? (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".xlsx,.xls"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (!f) return;
                                                void handleImportExcelFile(f);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="gray"
                                            highContrast
                                            className={styles.surfaceButton}
                                            disabled={isImportingExcel}
                                            onClick={() => {
                                                if (fileInputRef.current) fileInputRef.current.click();
                                            }}
                                        >
                                            <FiUpload size={16} /> Загрузить из Excel
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className={styles.contentGrid}>
                            <div className={styles.tableCard}>
                                {activeTab === 'stock' ? (
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Категория</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Остаток</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Цена покупки</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Цена продажи</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Обновлено</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell align="right"></Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                <AnimatePresence>
                                                    {filteredItems.map((item) => (
                                                        <MotionTableRow
                                                            key={item.id}
                                                            className={styles.tableRow}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            onClick={() => openItem(item)}
                                                        >
                                                            <Table.Cell>
                                                                <div>
                                                                    <div className={styles.itemTitle}>{item.id}</div>
                                                                    {renderAttachmentBadges(item.товар_id)}
                                                                </div>

                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{item.товар_название}</div>
                                                                <div className={styles.itemSub}>{item.товар_артикул}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.categoryPill}>{item.товар_категория || '-'}</span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.stockQty}>{item.количество} {item.товар_единица}</div>
                                                                <div className={styles.stockMin}>Мин: {item.товар_мин_остаток} {item.товар_единица}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={`${styles.badge} ${getStatusBadgeClass(item.stock_status)}`}>
                                                                    {getStockStatusText(item.stock_status)}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(item.товар_цена_закупки || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(item.товар_цена_продажи || 0)}</Table.Cell>
                                                            <Table.Cell>
                                                                {item.updated_at ? formatDate(item.updated_at) : '-'}
                                                            </Table.Cell>
                                                            <Table.Cell align="right" onClick={(e) => e.stopPropagation()}>
                                                                {(() => {
                                                                    const canMenuOpen = canView;
                                                                    const canMenuEdit = canEdit;
                                                                    const canMenuAdjust = canStockAdjust;
                                                                    const canMenuHistory = canView;
                                                                    const canMenuDelete = canDelete;
                                                                    const hasAnyMenuAction =
                                                                        canMenuOpen || canMenuEdit || canMenuAdjust || canMenuHistory || canMenuDelete;

                                                                    if (!hasAnyMenuAction) return null;

                                                                    return (
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="surface"
                                                                                    color="gray"
                                                                                    highContrast
                                                                                    className={styles.moreButton}
                                                                                >
                                                                                    <FiMoreHorizontal />
                                                                                </Button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Content>
                                                                                {canMenuOpen ? (
                                                                                    <DropdownMenu.Item onSelect={() => openItem(item)}>
                                                                                        <FiEye />
                                                                                        Открыть
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuEdit ? (
                                                                                    <DropdownMenu.Item onSelect={() => openEditModalFor(item)}>
                                                                                        <FiEdit2 />
                                                                                        Редактировать
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuAdjust ? (
                                                                                    <DropdownMenu.Item onSelect={() => openStockAdjustmentFor(item)}>
                                                                                        <FiSliders />
                                                                                        Корректировка остатка
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuHistory ? (
                                                                                    <DropdownMenu.Item onSelect={() => openItem(item)}>
                                                                                        <FiEye />
                                                                                        История движений
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuDelete ? (
                                                                                    <>
                                                                                        {canMenuOpen || canMenuEdit || canMenuAdjust || canMenuHistory ? (
                                                                                            <DropdownMenu.Separator />
                                                                                        ) : null}
                                                                                        <DropdownMenu.Item
                                                                                            className={styles.rowMenuItemDanger}
                                                                                            color="red"
                                                                                            onSelect={() => openDeleteModalFor(item)}
                                                                                        >
                                                                                            <FiTrash2 className={styles.rowMenuIconDel} />
                                                                                            Удалить
                                                                                        </DropdownMenu.Item>
                                                                                    </>
                                                                                ) : null}
                                                                            </DropdownMenu.Content>
                                                                        </DropdownMenu.Root>
                                                                    );
                                                                })()}
                                                            </Table.Cell>
                                                        </MotionTableRow>
                                                    ))}
                                                </AnimatePresence>
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                ) : null}
                                {activeTab === 'movements' ? (
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Документ</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Количество</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Комментарий</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                <AnimatePresence>
                                                    {filteredMovements.map((m) => (
                                                        <MotionTableRow
                                                            key={m.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <Table.Cell>
                                                                <span className={`${styles.badge} ${m.тип_операции === 'приход' ? styles.badgeIn : styles.badgeOut}`}>
                                                                    {m.тип_операции}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                {m.заявка_номер ? (
                                                                    <Link href={`/orders/${m.заявка_номер}`} className={styles.movementLink}>
                                                                        Заявка #{m.заявка_номер}
                                                                    </Link>
                                                                ) : m.закупка_номер ? (
                                                                    <Link href={`/purchases/${m.закупка_номер}`} className={styles.movementLink}>
                                                                        Закупка #{m.закупка_номер}
                                                                    </Link>
                                                                ) : m.отгрузка_номер ? (
                                                                    <Link href={`/shipments/${m.отгрузка_номер}`} className={styles.movementLink}>
                                                                        Отгрузка #{m.отгрузка_номер}
                                                                    </Link>
                                                                ) : (
                                                                    <span className={styles.muted}>—</span>
                                                                )}
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{m.товар_название || '—'}</div>
                                                                <div className={styles.itemSub}>{m.товар_артикул || '—'}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={`${styles.movementQty} ${m.тип_операции === 'приход' ? styles.movementQtyIn : styles.movementQtyOut}`}>
                                                                    {m.тип_операции === 'приход' ? '+' : '-'}{Math.abs(m.количество)}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                {m.комментарий ? m.комментарий : <span className={styles.muted}>—</span>}
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{formatDateTime(m.дата_операции)}</div>
                                                            </Table.Cell>
                                                        </MotionTableRow>
                                                    ))}
                                                </AnimatePresence>
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                ) : null}

                                {activeTab === 'critical' ? (
                                    <div className={styles.tableContainer}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Категория</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Остаток</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Цена покупки</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Цена продажи</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Обновлено</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell align="right"></Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                <AnimatePresence>
                                                    {filteredLowStock.map((item) => (
                                                        <MotionTableRow
                                                            key={item.id}
                                                            className={styles.tableRow}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            onClick={() => openItem(item)}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{item.id}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.itemTitle}>{item.товар_название}</div>
                                                                <div className={styles.itemSub}>{item.товар_артикул}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={styles.categoryPill}>{item.товар_категория || '-'}</span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.stockQty}>{item.количество} {item.товар_единица}</div>
                                                                <div className={styles.stockMin}>Мин: {item.товар_мин_остаток} {item.товар_единица}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <span className={`${styles.badge} ${getStatusBadgeClass(item.stock_status)}`}>
                                                                    {getStockStatusText(item.stock_status)}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(item.товар_цена_закупки || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(item.товар_цена_продажи || 0)}</Table.Cell>
                                                            <Table.Cell>
                                                                {item.updated_at ? formatDate(item.updated_at) : '-'}
                                                            </Table.Cell>
                                                            <Table.Cell align="right" onClick={(e) => e.stopPropagation()}>
                                                                {(() => {
                                                                    const canMenuOpen = canView;
                                                                    const canMenuEdit = canEdit;
                                                                    const canMenuAdjust = canStockAdjust;
                                                                    const canMenuHistory = canView;
                                                                    const canMenuDelete = canDelete;
                                                                    const hasAnyMenuAction =
                                                                        canMenuOpen || canMenuEdit || canMenuAdjust || canMenuHistory || canMenuDelete;

                                                                    if (!hasAnyMenuAction) return null;

                                                                    return (
                                                                        <DropdownMenu.Root>
                                                                            <DropdownMenu.Trigger>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="surface"
                                                                                    color="gray"
                                                                                    highContrast
                                                                                    className={styles.moreButton}
                                                                                >
                                                                                    <FiMoreHorizontal />
                                                                                </Button>
                                                                            </DropdownMenu.Trigger>
                                                                            <DropdownMenu.Content>
                                                                                {canMenuOpen ? (
                                                                                    <DropdownMenu.Item onSelect={() => openItem(item)}>
                                                                                        <FiEye />
                                                                                        Открыть
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuEdit ? (
                                                                                    <DropdownMenu.Item onSelect={() => openEditModalFor(item)}>
                                                                                        <FiEdit2 />
                                                                                        Редактировать
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuAdjust ? (
                                                                                    <DropdownMenu.Item onSelect={() => openStockAdjustmentFor(item)}>
                                                                                        <FiSliders />
                                                                                        Корректировка остатка
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuHistory ? (
                                                                                    <DropdownMenu.Item onSelect={() => openItem(item)}>
                                                                                        <FiEye />
                                                                                        История движений
                                                                                    </DropdownMenu.Item>
                                                                                ) : null}
                                                                                {canMenuDelete ? (
                                                                                    <>
                                                                                        {canMenuOpen || canMenuEdit || canMenuAdjust || canMenuHistory ? (
                                                                                            <DropdownMenu.Separator />
                                                                                        ) : null}
                                                                                        <DropdownMenu.Item
                                                                                            className={styles.dropdownDangerItem}
                                                                                            color="red"
                                                                                            onSelect={() => openDeleteModalFor(item)}
                                                                                        >
                                                                                            <FiTrash2 />
                                                                                            Удалить
                                                                                        </DropdownMenu.Item>
                                                                                    </>
                                                                                ) : null}
                                                                            </DropdownMenu.Content>
                                                                        </DropdownMenu.Root>
                                                                    );
                                                                })()}
                                                            </Table.Cell>
                                                        </MotionTableRow>
                                                    ))}
                                                </AnimatePresence>
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </Tabs.Root>
                </div>
            </div>

            <CreateProductModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onProductCreated={handleProductCreated}
            />

            <EditProductModal
                isOpen={isEditProductModalOpen}
                onClose={() => {
                    setIsEditProductModalOpen(false);
                    setSelectedWarehouseItem(null);
                }}
                onProductUpdated={() => {
                    setIsEditProductModalOpen(false);
                    setSelectedWarehouseItem(null);
                    fetchData();
                }}
                product={
                    selectedWarehouseItem
                        ? {
                            id: selectedWarehouseItem.товар_id,
                            название: selectedWarehouseItem.товар_название,
                            артикул: selectedWarehouseItem.товар_артикул,
                            категория: selectedWarehouseItem.товар_категория,
                            единица_измерения: selectedWarehouseItem.товар_единица,
                            минимальный_остаток: selectedWarehouseItem.товар_мин_остаток,
                            цена_закупки: selectedWarehouseItem.товар_цена_закупки || 0,
                            цена_продажи: selectedWarehouseItem.товар_цена_продажи || 0,
                        }
                        : null
                }
            />

            <Dialog.Root
                open={isDeleteModalOpen && !!selectedWarehouseItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDeleteModalOpen(false);
                        setSelectedWarehouseItem(null);
                    }
                }}
            >
                <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmationStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                Вы уверены, что хотите удалить этот товар со склада? Это действие нельзя отменить.
                            </Text>

                            {selectedWarehouseItem ? (
                                <Box className={deleteConfirmationStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">{selectedWarehouseItem.товар_название}</Text>
                                        <Text as="div" size="2" color="gray">Артикул: {selectedWarehouseItem.товар_артикул || '-'}</Text>
                                        <Text as="div" size="2" color="gray">Остаток: {selectedWarehouseItem.количество} {selectedWarehouseItem.товар_единица}</Text>
                                    </Flex>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmationStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setSelectedWarehouseItem(null);
                                    }}
                                    disabled={isDeleting}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="red"
                                    highContrast
                                    className={deleteConfirmationStyles.modalDeleteButton}
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>

            <AdjustStockModal
                isOpen={isAdjustStockModalOpen}
                onClose={() => {
                    setIsAdjustStockModalOpen(false);
                    setSelectedWarehouseItem(null);
                }}
                warehouseItem={
                    selectedWarehouseItem
                        ? {
                            id: selectedWarehouseItem.id,
                            товар_id: selectedWarehouseItem.товар_id,
                            товар_название: selectedWarehouseItem.товар_название,
                            товар_артикул: selectedWarehouseItem.товар_артикул,
                            товар_единица: selectedWarehouseItem.товар_единица,
                            количество: selectedWarehouseItem.количество,
                        }
                        : null
                }
                onSaved={() => {
                    fetchData();
                    setActiveTab('movements');
                }}
            />

            <WarehouseMovementModal
                isOpen={isMovementModalOpen}
                onClose={() => setIsMovementModalOpen(false)}
                initialType={movementModalInitialType}
                onSaved={() => {
                    fetchData();
                    setActiveTab('movements');
                }}
            />
        </Layout >
    );
}
