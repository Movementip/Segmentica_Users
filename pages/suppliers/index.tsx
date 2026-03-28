import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { CreateSupplierModalV2 } from '../../components/CreateSupplierModalV2';
import { EditSupplierModal, type EditSupplierModalSupplier } from '../../components/EditSupplierModal';
import styles from './Suppliers.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Dialog, DropdownMenu, Flex, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { AnimatePresence, motion } from 'framer-motion';
import { FiEdit2, FiEye, FiFilter, FiMail, FiMoreHorizontal, FiPhone, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiTruck } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

interface Supplier {
    id: number;
    название: string;
    телефон?: string;
    email?: string;
    рейтинг?: number;
    created_at: string;
    количество_товаров?: number;
    общая_сумма_закупок?: number;
    закупки_в_пути?: number;
}

const MotionTableRow = motion(Table.Row);

function SuppliersPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const lastSyncedQueryRef = useRef<string>('');
    const lastAppliedRouterQueryRef = useRef<string>('');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editSupplier, setEditSupplier] = useState<EditSupplierModalSupplier | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [tableKey, setTableKey] = useState(0);

    const [attachmentsTypesBySupplierId, setAttachmentsTypesBySupplierId] = useState<Record<number, string[]>>({});

    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const sortTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const [supplierNameQuery, setSupplierNameQuery] = useState('');

    const [filters, setFilters] = useState({
        inTransit: 'all',
        supplierName: '',
        rating: 'all',
        sortBy: 'name-asc',
    });

    const canList = Boolean(user?.permissions?.includes('suppliers.list'));
    const canView = Boolean(user?.permissions?.includes('suppliers.view'));
    const canCreate = Boolean(user?.permissions?.includes('suppliers.create'));
    const canEdit = Boolean(user?.permissions?.includes('suppliers.edit'));
    const canDelete = Boolean(user?.permissions?.includes('suppliers.delete'));
    const canOrdersHistoryView = Boolean(user?.permissions?.includes('suppliers.orders_history.view'));
    const canPurchasesList = Boolean(user?.permissions?.includes('purchases.list'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('suppliers.attachments.view'));

    const canShowOrdersHistory = canOrdersHistoryView && canPurchasesList;
    const hasRowActions = canView || canEdit || canDelete || canShowOrdersHistory;

    const syncSuppliersUrl = (next: { q: string; inTransit: string; rating: string; supplierName: string; sort: string }) => {
        const query = { ...router.query } as Record<string, any>;

        if ((next.q || '').trim()) query.q = String(next.q).trim();
        else delete query.q;

        if (next.inTransit && next.inTransit !== 'all') query.inTransit = String(next.inTransit);
        else delete query.inTransit;

        if (next.rating && next.rating !== 'all') query.rating = String(next.rating);
        else delete query.rating;

        if ((next.supplierName || '').trim()) query.name = String(next.supplierName).trim();
        else delete query.name;

        if (next.sort && next.sort !== 'name-asc') query.sort = String(next.sort);
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

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify(router.query);
        if (signature === lastAppliedRouterQueryRef.current) return;
        lastAppliedRouterQueryRef.current = signature;

        const qRaw = router.query.q;
        const inTransitRaw = router.query.inTransit;
        const ratingRaw = router.query.rating;
        const nameRaw = router.query.name;
        const sortRaw = router.query.sort;

        const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
        const inTransit = Array.isArray(inTransitRaw) ? inTransitRaw[0] : inTransitRaw;
        const rating = Array.isArray(ratingRaw) ? ratingRaw[0] : ratingRaw;
        const name = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
        const sort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        const nextQ = q !== undefined ? String(q) : '';
        const nextInTransit = inTransit ? String(inTransit) : 'all';
        const nextRating = rating ? String(rating) : 'all';
        const nextName = name !== undefined ? String(name) : '';
        const nextSort = sort ? String(sort) : 'name-asc';

        setSearchQuery(nextQ);
        setSupplierNameQuery(nextName);
        setFilters((prev) => ({
            ...prev,
            inTransit: nextInTransit,
            rating: nextRating,
            supplierName: nextName,
            sortBy: nextSort,
        }));

        const nextSignature = JSON.stringify({ q: nextQ, inTransit: nextInTransit, rating: nextRating, name: nextName, sort: nextSort });
        lastSyncedQueryRef.current = nextSignature;
    }, [router.isReady, router.query]);

    useEffect(() => {
        if (!router.isReady) return;

        const signature = JSON.stringify({
            q: searchQuery,
            inTransit: filters.inTransit,
            rating: filters.rating,
            name: filters.supplierName,
            sort: filters.sortBy,
        });

        if (signature === lastSyncedQueryRef.current) return;
        lastSyncedQueryRef.current = signature;

        syncSuppliersUrl({
            q: searchQuery,
            inTransit: filters.inTransit,
            rating: filters.rating,
            supplierName: filters.supplierName,
            sort: filters.sortBy,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, searchQuery, filters.inTransit, filters.rating, filters.supplierName, filters.sortBy]);

    const supplierNameOptions = useMemo((): string[] => {
        const set = new Set<string>();
        for (const s of suppliers) {
            const name = (s.название || '').trim();
            if (name) set.add(name);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [suppliers]);

    const filteredSupplierNameOptions = useMemo(() => {
        const q = supplierNameQuery.trim().toLowerCase();
        if (!q) return supplierNameOptions;
        return supplierNameOptions.filter((n) => n.toLowerCase().includes(q));
    }, [supplierNameOptions, supplierNameQuery]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchSuppliers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canList]);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const fetchSuppliers = async () => {
        try {
            setError(null);

            if (!canList) {
                setSuppliers([]);
                setAttachmentsTypesBySupplierId({});
                return;
            }

            if (suppliers.length === 0) {
                setLoading(true);
            } else {
                setIsRefreshing(true);
            }

            const response = await fetch('/api/suppliers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщиков');
            }

            const data = await response.json();
            setSuppliers(data);

            const supplierIds = (Array.isArray(data) ? data : [])
                .map((s: Supplier) => Number(s.id))
                .filter((n: number) => Number.isInteger(n) && n > 0);

            if (!canAttachmentsView) {
                setAttachmentsTypesBySupplierId({});
            } else if (supplierIds.length > 0) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=supplier&entity_ids=${encodeURIComponent(supplierIds.join(','))}`
                    );
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as Array<{ entity_id: number; types: string[] }>;
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesBySupplierId(map);
                    }
                } catch (e) {
                    console.error('Error fetching supplier attachments summary:', e);
                }
            } else {
                setAttachmentsTypesBySupplierId({});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const renderAttachmentBadges = (supplierId: number) => {
        const types = attachmentsTypesBySupplierId[supplierId] || [];
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const filteredSuppliers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let list = suppliers;

        if (query) {
            list = list.filter((supplier) => {
                const name = supplier.название?.toLowerCase() || '';
                const phone = supplier.телефон?.toLowerCase() || '';
                const email = supplier.email?.toLowerCase() || '';
                return name.includes(query) || phone.includes(query) || email.includes(query) || String(supplier.id).includes(query);
            });
        }

        if (filters.inTransit !== 'all') {
            const want = filters.inTransit === 'yes';
            list = list.filter((s) => ((s.закупки_в_пути || 0) > 0) === want);
        }

        if (filters.rating !== 'all') {
            const r = Number(filters.rating);
            if (!Number.isNaN(r)) {
                list = list.filter((s) => Math.floor(Number(s.рейтинг) || 0) === r);
            }
        }

        if (filters.supplierName.trim()) {
            const q = filters.supplierName.trim().toLowerCase();
            list = list.filter((s) => (s.название || '').toLowerCase().includes(q));
        }

        const sorted = [...list];
        sorted.sort((a, b) => {
            switch (filters.sortBy) {
                case 'rating-desc':
                    return (Number(b.рейтинг) || 0) - (Number(a.рейтинг) || 0);
                case 'sum-desc':
                    return (Number(b.общая_сумма_закупок) || 0) - (Number(a.общая_сумма_закупок) || 0);
                case 'products-desc':
                    return (Number(b.количество_товаров) || 0) - (Number(a.количество_товаров) || 0);
                case 'name-desc':
                    return (a.название || '').localeCompare(b.название || '', 'ru');
                case 'name-asc':
                default:
                    return (a.название || '').localeCompare(b.название || '', 'ru');
            }
        });

        return sorted;
    }, [filters.inTransit, filters.rating, filters.sortBy, filters.supplierName, searchQuery, suppliers]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null;
            const withinDropdown = filtersDropdownRef.current?.contains(target ?? null);
            const withinTrigger = filterTriggerRef.current?.contains(target ?? null);
            const withinPanel = filtersPanelRef.current?.contains(target ?? null);
            const withinRadixSelectContent = Boolean(
                (target as HTMLElement | null)?.closest?.('[data-radix-popper-content-wrapper]')
            );
            const panelRect = filtersPanelRef.current?.getBoundingClientRect();
            const withinPanelRect = Boolean(
                panelRect &&
                e.clientX >= panelRect.left &&
                e.clientX <= panelRect.right &&
                e.clientY >= panelRect.top &&
                e.clientY <= panelRect.bottom
            );
            if (withinDropdown || withinTrigger || withinPanel) return;
            if (withinPanelRect) return;
            if (withinRadixSelectContent) return;
            setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [isFiltersOpen]);

    const summary = useMemo(() => {
        const totalProducts = suppliers.reduce((sum, supplier) => sum + (supplier.количество_товаров || 0), 0);
        const totalPurchaseSum = suppliers.reduce((sum, supplier) => sum + (supplier.общая_сумма_закупок || 0), 0);
        const suppliersInTransit = suppliers.filter((supplier) => (supplier.закупки_в_пути || 0) > 0).length;

        return {
            totalSuppliers: suppliers.length,
            totalProducts,
            totalPurchaseSum,
            suppliersInTransit,
        };
    }, [suppliers]);

    const handleCreateSupplier = () => {
        if (!canCreate) return;
        setIsCreateModalOpen(true);
    };

    const handleDeleteSupplier = (supplier: Supplier) => {
        if (!canDelete) return;
        setSelectedSupplier(supplier);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedSupplier) return;
        if (!canDelete) return;

        try {
            const response = await fetch(`/api/suppliers?id=${selectedSupplier.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления поставщика');
            }

            await fetchSuppliers();
            setIsDeleteModalOpen(false);
            setSelectedSupplier(null);
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('Ошибка удаления поставщика: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleSupplierCreated = () => {
        fetchSuppliers();
        setIsCreateModalOpen(false);
    };

    const openEditModal = (supplier: Supplier) => {
        if (!canEdit) return;
        setEditSupplier({
            id: supplier.id,
            название: supplier.название,
            телефон: supplier.телефон,
            email: supplier.email,
            рейтинг: supplier.рейтинг,
        });
        setIsEditModalOpen(true);
    };

    if (authLoading) {
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.loadingState}>
                        <div className={styles.loadingSpinner}></div>
                        <Text as="div" size="3" color="gray">Загрузка поставщиков...</Text>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.pageShell}>
                    <div className={styles.errorState}>
                        <Text as="div" size="4" weight="bold">Ошибка загрузки</Text>
                        <Text as="div" size="2" color="red">{error}</Text>
                        <Button onClick={fetchSuppliers}>Повторить попытку</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageShell}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>Поставщики</h1>
                            <p className={styles.subtitle}>Управление базой поставщиков, ассортиментом и активными закупками.</p>
                        </div>

                        <div className={styles.headerActions}>
                            <Button
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                onClick={() => {
                                    setIsRefreshing(true);
                                    setMinRefreshSpinActive(true);
                                    setRefreshClickKey((value) => value + 1);
                                    setTableKey((k) => k + 1);
                                    fetchSuppliers();
                                }}
                                className={`${styles.surfaceButton} ${styles.headerActionButton} ${(isRefreshing || minRefreshSpinActive) ? styles.refreshButtonSpinning : ''}`.trim()}
                            >
                                <FiRefreshCw
                                    key={refreshClickKey}
                                    size={14}
                                    className={(isRefreshing || minRefreshSpinActive) ? styles.spin : undefined}
                                />
                                Обновить
                            </Button>

                            {canCreate ? (
                                <Button
                                    type="button"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    onClick={handleCreateSupplier}
                                    className={`${styles.addSupplierButton} ${styles.headerActionButtonDel}`}
                                >
                                    <FiPlus size={14} /> Добавить поставщика
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.statsContainer}>
                        <h2 className={styles.statsTitle}>Статистика поставщиков</h2>
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.total}`}>{summary.totalSuppliers}</div>
                                <div className={styles.statLabel}>Всего поставщиков</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue}`}>{summary.totalProducts}</div>
                                <div className={styles.statLabel}>Всего товаров</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.completed}`}>{formatCurrency(summary.totalPurchaseSum)}</div>
                                <div className={styles.statLabel}>Сумма товаров</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={`${styles.statValue} ${styles.inProgress}`}>{summary.suppliersInTransit}</div>
                                <div className={styles.statLabel}>Поставщики в работе</div>

                            </div>
                        </div>
                    </div>

                    <div className={styles.searchSection}>
                        <TextField.Root
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по названию, телефону, email или ID..."
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
                                    onClick={() => setIsFiltersOpen((v) => !v)}
                                    aria-expanded={isFiltersOpen}
                                    data-state={isFiltersOpen ? 'open' : 'closed'}
                                >
                                    <span className={styles.triggerLabel}>
                                        <FiFilter className={styles.icon} />
                                        Фильтры
                                    </span>
                                </Button>

                                {isFiltersOpen ? (
                                    <Box ref={filtersPanelRef} className={styles.filtersDropdownPanel} data-suppliers-filters-dropdown>
                                        <Tabs.Root defaultValue="inTransit">
                                            <Tabs.List className={styles.filtersTabs}>
                                                <Tabs.Trigger value="inTransit">В работе</Tabs.Trigger>
                                                <Tabs.Trigger value="name">Поставщик</Tabs.Trigger>
                                                <Tabs.Trigger value="rating">Рейтинг</Tabs.Trigger>
                                            </Tabs.List>

                                            <Box pt="3">
                                                <Tabs.Content value="inTransit">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">В работе</Text>
                                                        <Select.Root
                                                            value={filters.inTransit}
                                                            onValueChange={(value) => {
                                                                setFilters((prev) => ({ ...prev, inTransit: value }));
                                                            }}
                                                        >
                                                            <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                            <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                                <Select.Item value="all">Все</Select.Item>
                                                                <Select.Item value="yes">Только в работе</Select.Item>
                                                                <Select.Item value="no">Только без закупок</Select.Item>
                                                            </Select.Content>
                                                        </Select.Root>
                                                    </Box>
                                                </Tabs.Content>

                                                <Tabs.Content value="name">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Поставщик</Text>
                                                        <TextArea
                                                            size="2"
                                                            variant="surface"
                                                            resize="none"
                                                            radius="large"
                                                            placeholder="Начни вводить имя поставщика…"
                                                            value={supplierNameQuery}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setSupplierNameQuery(v);
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    supplierName: v,
                                                                }));
                                                            }}
                                                            className={styles.filterTextArea}
                                                        />

                                                        {supplierNameQuery.trim() ? (
                                                            <div className={styles.inlineSuggestList}>
                                                                {filteredSupplierNameOptions.length === 0 ? (
                                                                    <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                                ) : (
                                                                    filteredSupplierNameOptions.slice(0, 10).map((name) => (
                                                                        <button
                                                                            key={name}
                                                                            type="button"
                                                                            className={styles.inlineSuggestItem}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                setSupplierNameQuery(name);
                                                                                setFilters((prev) => ({ ...prev, supplierName: name }));
                                                                            }}
                                                                        >
                                                                            {name}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </Box>
                                                </Tabs.Content>

                                                <Tabs.Content value="rating">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Рейтинг</Text>
                                                        <Select.Root
                                                            value={filters.rating}
                                                            onValueChange={(value) => {
                                                                setFilters((prev) => ({ ...prev, rating: value }));
                                                            }}
                                                        >
                                                            <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                            <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                                                <Select.Item value="all">Любой</Select.Item>
                                                                <Select.Item value="5">5</Select.Item>
                                                                <Select.Item value="4">4</Select.Item>
                                                                <Select.Item value="3">3</Select.Item>
                                                                <Select.Item value="2">2</Select.Item>
                                                                <Select.Item value="1">1</Select.Item>
                                                                <Select.Item value="0">0</Select.Item>
                                                            </Select.Content>
                                                        </Select.Root>
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
                                                    setSupplierNameQuery('');
                                                    setFilters((prev) => ({ ...prev, inTransit: 'all', supplierName: '', rating: 'all' }));
                                                }}
                                            >
                                                Сбросить
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => setIsFiltersOpen(false)}
                                            >
                                                Закрыть
                                            </Button>
                                        </Flex>
                                    </Box>
                                ) : null}
                            </div>

                            <div className={styles.sortDropdown}>
                                <span>Сортировка: </span>
                                <Select.Root
                                    value={filters.sortBy}
                                    onValueChange={(value) => {
                                        setFilters((prev) => ({ ...prev, sortBy: value }));
                                    }}
                                >
                                    <Select.Trigger
                                        className={styles.sortSelectTrigger}
                                        ref={sortTriggerRef}
                                        variant="surface"
                                        color="gray"
                                    />
                                    <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                        <Select.Item value="name-asc">По названию (А-Я)</Select.Item>
                                        <Select.Item value="name-desc">По названию (Я-А)</Select.Item>
                                        <Select.Item value="rating-desc">По рейтингу</Select.Item>
                                        <Select.Item value="products-desc">По товарам</Select.Item>
                                        <Select.Item value="sum-desc">По сумме закупок</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                    </div>

                    <div className={styles.tableContainer} key={tableKey}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Поставщик</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Контакты</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell align="right" className={`${styles.textRight} ${styles.productsColumn}`}>Товаров</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell align="right" className={`${styles.textRight} ${styles.sumColumn}`}>Сумма закупок</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>В работе</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Дата регистрации</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {filteredSuppliers.length === 0 ? (
                                    <Table.Row>
                                        <Table.Cell colSpan={8}>
                                            <div className={styles.emptyState}>Поставщики не найдены.</div>
                                        </Table.Cell>
                                    </Table.Row>
                                ) : (
                                    <AnimatePresence>
                                        {filteredSuppliers.map((supplier) => {
                                            const inTransit = supplier.закупки_в_пути || 0;

                                            return (
                                                <MotionTableRow
                                                    key={supplier.id}
                                                    className={styles.tableRow}
                                                    onClick={() => {
                                                        if (!canView) return;
                                                        router.push(`/suppliers/${supplier.id}`);
                                                    }}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <Table.Cell className={styles.tableCell}>
                                                        <div>
                                                            <span className={styles.supplierId}>#{supplier.id}</span>
                                                            {renderAttachmentBadges(supplier.id)}
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.tableCell}>
                                                        <div className={styles.itemTitle}>{supplier.название}</div>
                                                        <div className={styles.itemSub}>Рейтинг: {supplier.рейтинг ?? '—'} / 5</div>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.tableCell}>
                                                        <div className={styles.contactStack}>
                                                            {supplier.телефон ? (
                                                                <div className={styles.contactLine}><FiPhone size={14} /> {supplier.телефон}</div>
                                                            ) : null}
                                                            {supplier.email ? (
                                                                <div className={styles.contactLine}><FiMail size={14} /> {supplier.email}</div>
                                                            ) : null}
                                                            {!supplier.телефон && !supplier.email ? (
                                                                <div className={styles.itemSub}>Контакты не указаны</div>
                                                            ) : null}
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell align="right" className={`${styles.tableCell} ${styles.textRight} ${styles.productsColumn}`}>
                                                        <span className={styles.metricValue}>{supplier.количество_товаров || 0}</span>
                                                    </Table.Cell>
                                                    <Table.Cell align="right" className={`${styles.tableCell} ${styles.textRight} ${styles.sumColumn}`}>
                                                        <span className={styles.moneyValue}>{formatCurrency(supplier.общая_сумма_закупок || 0)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.tableCell}>
                                                        <div className={`${styles.statusBadge} ${inTransit > 0 ? styles.statusWarning : styles.statusSuccess}`}>
                                                            <FiTruck size={14} />
                                                            {inTransit > 0 ? `${inTransit} в пути` : 'Нет активных'}
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.tableCell}>
                                                        <span className={styles.itemSub}>{formatDate(supplier.created_at)}</span>
                                                    </Table.Cell>
                                                    <Table.Cell className={styles.tableCell}>
                                                        {hasRowActions ? (
                                                            <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                                <DropdownMenu.Root>
                                                                    <DropdownMenu.Trigger>
                                                                        <button
                                                                            type="button"
                                                                            className={styles.menuButton}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <FiMoreHorizontal size={18} />
                                                                        </button>
                                                                    </DropdownMenu.Trigger>

                                                                    <DropdownMenu.Content align="end" variant="solid" color="gray" highContrast>
                                                                        {canView ? (
                                                                            <DropdownMenu.Item
                                                                                onClick={() => router.push(`/suppliers/${supplier.id}`)}
                                                                            >
                                                                                <FiEye size={14} className={styles.rowMenuIcon} /> Посмотреть
                                                                            </DropdownMenu.Item>
                                                                        ) : null}

                                                                        {canEdit ? (
                                                                            <DropdownMenu.Item
                                                                                onClick={() => openEditModal(supplier)}
                                                                            >
                                                                                <FiEdit2 size={14} className={styles.rowMenuIcon} /> Редактировать
                                                                            </DropdownMenu.Item>
                                                                        ) : null}

                                                                        {canShowOrdersHistory ? (
                                                                            <DropdownMenu.Item
                                                                                onClick={() => router.push(`/purchases?supplier_id=${supplier.id}`)}
                                                                            >
                                                                                <FiTruck size={14} className={styles.rowMenuIcon} /> История заказов
                                                                            </DropdownMenu.Item>
                                                                        ) : null}

                                                                        {(canView || canEdit || canShowOrdersHistory) && canDelete ? <DropdownMenu.Separator /> : null}

                                                                        {canDelete ? (
                                                                            <DropdownMenu.Item color="red" className={styles.rowMenuItemDanger} onClick={() => handleDeleteSupplier(supplier)}>
                                                                                <FiTrash2 className={styles.rowMenuIconDel} size={14} /> Удалить
                                                                            </DropdownMenu.Item>
                                                                        ) : null}
                                                                    </DropdownMenu.Content>
                                                                </DropdownMenu.Root>
                                                            </div>
                                                        ) : null}
                                                    </Table.Cell>
                                                </MotionTableRow>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </Table.Body>
                        </Table.Root>
                    </div>
                </div>
            </div>

            {canCreate ? (
                <CreateSupplierModalV2
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSupplierCreated={handleSupplierCreated}
                />
            ) : null}

            {canEdit ? (
                <EditSupplierModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdated={fetchSuppliers}
                    supplier={editSupplier}
                />
            ) : null}

            {canDelete && isDeleteModalOpen && selectedSupplier ? (
                <Dialog.Root open={isDeleteModalOpen} onOpenChange={(open) => (!open ? setIsDeleteModalOpen(false) : undefined)}>
                    <Dialog.Content className={deleteConfirmStyles.modalContent}>
                        <Dialog.Title>Подтверждение удаления</Dialog.Title>
                        <Box className={deleteConfirmStyles.form}>
                            <Flex direction="column" gap="3">
                                <Text as="div" size="2" color="gray">
                                    Вы уверены, что хотите удалить поставщика? Это действие нельзя отменить.
                                </Text>

                                <Box className={deleteConfirmStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">{selectedSupplier.название}</Text>
                                        {selectedSupplier.телефон ? (
                                            <Text as="div" size="2" color="gray">Телефон: {selectedSupplier.телефон}</Text>
                                        ) : null}
                                        {selectedSupplier.email ? (
                                            <Text as="div" size="2" color="gray">Email: {selectedSupplier.email}</Text>
                                        ) : null}
                                    </Flex>
                                </Box>

                                <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                    <Button type="button" variant="surface" color="gray" highContrast onClick={() => setIsDeleteModalOpen(false)}>
                                        Отмена
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="red"
                                        highContrast
                                        className={deleteConfirmStyles.modalDeleteButton}
                                        onClick={handleConfirmDelete}
                                    >
                                        Удалить
                                    </Button>
                                </Flex>
                            </Flex>
                        </Box>
                    </Dialog.Content>
                </Dialog.Root>
            ) : null}
        </div>
    );
}

export default withLayout(SuppliersPage);