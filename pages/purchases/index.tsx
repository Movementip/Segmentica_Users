import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import { CreatePurchaseModal } from '../../components/CreatePurchaseModal';
import EditPurchaseModal from '../../components/EditPurchaseModal';
import deleteConfirmationStyles from '../../components/DeleteConfirmation.module.css';
import styles from './Purchases.module.css';
import { FiEdit2, FiEye, FiFilter, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Box, Button, Card, Dialog, DropdownMenu, Flex, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';

const MotionTableRow = motion(Table.Row);

interface Purchase {
    id: number;
    поставщик_id: number;
    поставщик_название?: string;
    поставщик_телефон?: string;
    поставщик_email?: string;
    заявка_id?: number;
    дата_заказа: string;
    дата_поступления?: string;
    статус: string;
    общая_сумма: number;
}

interface Supplier {
    id: number;
    название: string;
    телефон: string;
    email: string;
}

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

function PurchasesPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const canList = Boolean(user?.permissions?.includes('purchases.list'));
    const canView = Boolean(user?.permissions?.includes('purchases.view'));
    const canCreate = Boolean(user?.permissions?.includes('purchases.create'));
    const canEdit = Boolean(user?.permissions?.includes('purchases.edit'));
    const canDelete = Boolean(user?.permissions?.includes('purchases.delete'));
    const canOrderView = Boolean(user?.permissions?.includes('orders.view'));
    const canPurchaseOrderView = Boolean(user?.permissions?.includes('purchases.order.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('purchases.attachments.view'));
    const { order_id } = router.query;
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const didInitialLoadRef = useRef(false);
    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0);
    const [selectedSupplier, setSelectedSupplier] = useState<{ id: number, название: string } | null>(null);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const [operationLoading, setOperationLoading] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const [searchInputValue, setSearchInputValue] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    const [attachmentsTypesByPurchaseId, setAttachmentsTypesByPurchaseId] = useState<Record<number, string[]>>({});

    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const sortTriggerRef = useRef<HTMLButtonElement>(null);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

    const [supplierQuery, setSupplierQuery] = useState('');
    const lastSyncedSupplierIdRef = useRef<string>('all');

    const [filters, setFilters] = useState({
        status: 'all',
        supplierId: 'all',
        supplierName: '',
        orderId: '',
        sortBy: 'date-desc',
    });

    const syncPurchasesUrl = (next: { status: string; supplierId: string; supplierName: string; orderId: string; sortBy: string }) => {
        const query = { ...router.query } as Record<string, any>;

        if (next.status && next.status !== 'all') query.status = String(next.status);
        else delete query.status;

        if (next.supplierId && next.supplierId !== 'all') query.supplier_id = String(next.supplierId);
        else delete query.supplier_id;

        if ((next.supplierName || '').trim()) query.supplier = String(next.supplierName).trim();
        else delete query.supplier;

        if ((next.orderId || '').trim()) query.order_id = String(next.orderId).trim();
        else delete query.order_id;

        if (next.sortBy && next.sortBy !== 'date-desc') query.sort = String(next.sortBy);
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

        const statusRaw = router.query.status;
        const supplierIdRaw = router.query.supplier_id;
        const supplierNameRaw = router.query.supplier;
        const orderIdRaw = router.query.order_id;
        const sortRaw = router.query.sort;

        const st = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const sid = Array.isArray(supplierIdRaw) ? supplierIdRaw[0] : supplierIdRaw;
        const sn = Array.isArray(supplierNameRaw) ? supplierNameRaw[0] : supplierNameRaw;
        const oid = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
        const sr = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        setFilters((prev) => ({
            ...prev,
            status: st ? String(st) : prev.status,
            supplierId: sid ? String(sid) : prev.supplierId,
            supplierName: sn ? String(sn) : prev.supplierName,
            orderId: oid ? String(oid) : prev.orderId,
            sortBy: sr ? String(sr) : prev.sortBy,
        }));

        if (sn) setSupplierQuery(String(sn));
    }, [router.isReady]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchPurchases();
        fetchSuppliers();
    }, [authLoading, canList]);

    useEffect(() => {
        if (!router.isReady) return;
        if (!suppliers || suppliers.length === 0) return;
        if (!filters.supplierId || filters.supplierId === 'all') return;

        // If we navigated with supplier_id only, make sure the supplier name is shown in the UI.
        if (filters.supplierName.trim()) return;

        const match = suppliers.find((s) => String(s.id) === String(filters.supplierId));
        if (!match) return;

        setSupplierQuery(match.название);
        setFilters((prev) => ({ ...prev, supplierName: match.название }));
        // Keep URL consistent: supplier_id is enough for exact filtering.
        syncPurchasesUrl({
            status: filters.status,
            supplierId: String(filters.supplierId),
            supplierName: '',
            orderId: filters.orderId,
            sortBy: filters.sortBy,
        });
    }, [router.isReady, suppliers, filters.supplierId, filters.supplierName, filters.status, filters.orderId, filters.sortBy]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchInputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInputValue]);

    const fetchPurchases = async (options?: { updateStats?: boolean }) => {
        const updateStats = options?.updateStats !== false;
        try {
            if (!didInitialLoadRef.current) {
                setLoading(true);
            }
            const response = await fetch('/api/purchases');

            if (!response.ok) {
                throw new Error('Ошибка загрузки закупок');
            }

            let data = await response.json();

            const rawPurchases: Purchase[] = Array.isArray(data) ? data : [];
            if (updateStats) {
                setAllPurchases([...rawPurchases]);
            }

            data = [...rawPurchases];

            // Apply search
            if (debouncedSearchQuery) {
                const q = debouncedSearchQuery.trim().toLowerCase();
                data = (Array.isArray(data) ? data : []).filter((p: Purchase) => {
                    return (
                        String(p.id).includes(q) ||
                        String(p.заявка_id ?? '').includes(q) ||
                        (p.поставщик_название || '').toLowerCase().includes(q) ||
                        (p.поставщик_телефон || '').toLowerCase().includes(q) ||
                        (p.статус || '').toLowerCase().includes(q)
                    );
                });
            }

            // Apply order query param filter (legacy)
            if (order_id) {
                const oid = Number(order_id);
                if (!Number.isNaN(oid)) {
                    data = (Array.isArray(data) ? data : []).filter((p: Purchase) => Number(p.заявка_id) === oid);
                }
            }

            // Apply статус filter
            if (filters.status !== 'all') {
                data = (Array.isArray(data) ? data : []).filter((p: Purchase) => (p.статус || '').toLowerCase() === filters.status);
            }

            // Apply supplierId filter
            if (filters.supplierId !== 'all') {
                data = (Array.isArray(data) ? data : []).filter((p: Purchase) => String(p.поставщик_id) === String(filters.supplierId));
            }

            // Apply supplierName substring filter
            if (filters.supplierName.trim()) {
                const sq = filters.supplierName.trim().toLowerCase();
                data = (Array.isArray(data) ? data : []).filter((p: Purchase) => (p.поставщик_название || '').toLowerCase().includes(sq));
            }

            // Apply orderId filter
            if (filters.orderId.trim()) {
                const oqRaw = filters.orderId.trim();
                const oq = oqRaw.replace(/^#/, '').trim();
                const oqNum = Number(oq);

                data = (Array.isArray(data) ? data : []).filter((p: Purchase) => {
                    const pidRaw = p.заявка_id;
                    if (pidRaw === null || pidRaw === undefined) return false;

                    if (!Number.isNaN(oqNum) && oq !== '') {
                        return Number(pidRaw) === oqNum;
                    }

                    return String(pidRaw).toLowerCase().includes(oq.toLowerCase());
                });
            }

            // Apply sorting
            const nextPurchases = [...(Array.isArray(data) ? data : [])];
            nextPurchases.sort((a: Purchase, b: Purchase) => {
                switch (filters.sortBy) {
                    case 'sum-asc':
                        return (a.общая_сумма || 0) - (b.общая_сумма || 0);
                    case 'sum-desc':
                        return (b.общая_сумма || 0) - (a.общая_сумма || 0);
                    case 'date-asc':
                        return new Date(a.дата_заказа).getTime() - new Date(b.дата_заказа).getTime();
                    case 'date-desc':
                    default:
                        return new Date(b.дата_заказа).getTime() - new Date(a.дата_заказа).getTime();
                }
            });

            setPurchases(nextPurchases);

            const ids = nextPurchases.map((p) => Number(p.id)).filter((n) => Number.isInteger(n) && n > 0);
            if (canAttachmentsView && ids.length > 0) {
                try {
                    const summaryRes = await fetch(`/api/attachments/summary?entity_type=purchase&entity_ids=${encodeURIComponent(ids.join(','))}`);
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as AttachmentSummaryItem[];
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByPurchaseId(map);
                    }
                } catch (e) {
                    console.error('Error fetching purchases attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByPurchaseId({});
            }
            didInitialLoadRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const renderAttachmentBadges = (purchaseId: number) => {
        const types = attachmentsTypesByPurchaseId[purchaseId] || [];
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

    const handleEditPurchase = async (purchaseData: any) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchaseData.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(purchaseData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления закупки');
            }

            await fetchPurchases();
            setIsEditModalOpen(false);
            setSelectedPurchase(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка обновления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePurchaseConfirm = async () => {
        if (!selectedPurchase) return;
        try {
            if (!canDelete) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            setShowCreateModal(false);
            setSelectedSupplier(null);
            const response = await fetch(`/api/purchases?id=${selectedPurchase.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления закупки');
            }
            await fetchPurchases();
            setIsDeleteConfirmOpen(false);
            setSelectedPurchase(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка удаления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    useEffect(() => {
        if (!router.isReady) return;
        fetchPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, order_id, debouncedSearchQuery, filters]);

    const supplierOptions = useMemo((): { id: number; name: string }[] => {
        const map = new Map<number, string>();
        for (const p of purchases) {
            const name = (p.поставщик_название || '').trim();
            if (!p.поставщик_id || !name) continue;
            if (!map.has(p.поставщик_id)) map.set(p.поставщик_id, name);
        }
        const res = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
        res.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return res;
    }, [purchases]);

    const filteredSupplierOptions = useMemo(() => {
        const q = supplierQuery.trim().toLowerCase();
        if (!q) return supplierOptions;
        return supplierOptions.filter((s) => s.name.toLowerCase().includes(q));
    }, [supplierOptions, supplierQuery]);

    useEffect(() => {
        if (filters.supplierId === lastSyncedSupplierIdRef.current) return;
        lastSyncedSupplierIdRef.current = filters.supplierId;

        if (filters.supplierId === 'all') {
            setSupplierQuery('');
            return;
        }

        const match = supplierOptions.find((s) => String(s.id) === String(filters.supplierId));
        if (match) {
            setSupplierQuery(match.name);
            setFilters((prev) => ({ ...prev, supplierName: match.name }));
        }
    }, [filters.supplierId, supplierOptions]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (isStatusSelectOpen) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((e.target as Node | null) && filtersDropdownRef.current?.contains(e.target as Node));

            const isInsideTrigger = path.length
                ? path.includes(filterTriggerRef.current as unknown as EventTarget)
                : Boolean((e.target as Node | null) && filterTriggerRef.current?.contains(e.target as Node));

            if (isInsideDropdown || isInsideTrigger) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-purchases-filters-select-content')) return true;
                return Boolean(
                    node.closest('[data-purchases-filters-select-content]') ||
                    node.closest('.rt-SelectContent') ||
                    node.closest('[data-radix-select-content]')
                );
            });

            if (isInSelectPortal) return;
            setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [isFiltersOpen, isStatusSelectOpen]);

    useEffect(() => {
        if (!isFiltersOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFiltersOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isFiltersOpen]);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/suppliers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщиков');
            }

            const data = await response.json();
            setSuppliers(data);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'заказано':
                return '#2196F3';
            case 'в пути':
                return '#ff9800';
            case 'получено':
                return '#4CAF50';
            case 'отменено':
                return '#f44336';
            default:
                return '#9e9e9e';
        }
    };

    const getStatusText = (status: string) => {
        switch ((status || '').toLowerCase()) {
            case 'заказано':
                return 'ЗАКАЗАНО';
            case 'в пути':
                return 'В ПУТИ';
            case 'получено':
                return 'ПОЛУЧЕНО';
            case 'отменено':
                return 'ОТМЕНЕНО';
            default:
                return String(status || '').toUpperCase();
        }
    };

    const handleCreatePurchase = () => {
        if (!canCreate) {
            setError('Нет доступа');
            return;
        }
        if (suppliers.length > 0) {
            setSelectedSupplier(null);
            setCreatePurchaseModalKey((prev) => prev + 1);
            setShowCreateModal(true);
        } else {
            alert('Сначала добавьте поставщиков в систему');
        }
    };

    const handlePurchaseClick = (purchaseId: number) => {
        if (!canView) return;
        router.push(`/purchases/${purchaseId}`);
    };

    const handleOpenOrder = (purchase: Purchase) => {
        if (!purchase.заявка_id) return;
        if (!canOrderView || !canPurchaseOrderView) return;
        router.push(`/orders/${purchase.заявка_id}`);
    };

    const activePurchasesCount = useMemo(() => {
        return allPurchases.filter((p) => {
            const s = (p.статус || '').toLowerCase();
            return s !== 'получено' && s !== 'отменено';
        }).length;
    }, [allPurchases]);

    const inTransitCount = useMemo(() => {
        return allPurchases.filter((p) => (p.статус || '').toLowerCase() === 'в пути').length;
    }, [allPurchases]);

    const monthSum = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();

        return allPurchases.reduce((sum, p) => {
            const d = p.дата_заказа ? new Date(p.дата_заказа) : null;
            if (!d || Number.isNaN(d.getTime())) return sum;
            if (d.getMonth() !== month || d.getFullYear() !== year) return sum;
            return sum + (Number(p.общая_сумма) || 0);
        }, 0);
    }, [allPurchases]);

    const completedThisYearCount = useMemo(() => {
        const year = new Date().getFullYear();
        return allPurchases.filter((p) => {
            if ((p.статус || '').toLowerCase() !== 'получено') return false;
            const raw = p.дата_поступления || p.дата_заказа;
            if (!raw) return false;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return false;
            return d.getFullYear() === year;
        }).length;
    }, [allPurchases]);

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

    return (
        <div className={styles.container}>

            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <div className={styles.title}>Управление закупками</div>
                        <p className={styles.subtitle}>Управление закупками у поставщиков</p>
                    </div>

                    <div className={styles.headerActions}>


                        <div className={styles.buttonGroup}>
                            <Button
                                asChild
                                type="button"
                                variant="surface"
                                color="gray"
                                highContrast
                                className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.currentTarget.blur();
                                        setIsFetching(true);
                                        setTableKey((k) => k + 1);
                                        setRefreshClickKey((k) => k + 1);
                                        setMinRefreshSpinActive(true);
                                        fetchPurchases({ updateStats: false });
                                    }}
                                >
                                    <FiRefreshCw
                                        key={refreshClickKey}
                                        className={`${styles.icon} ${isFetching || minRefreshSpinActive ? styles.spin : ''}`}
                                    />
                                    Обновить
                                </button>
                            </Button>

                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.primaryButton} ${styles.headerActionButton}`}
                                onClick={handleCreatePurchase}
                                style={!canCreate ? { display: 'none' } : undefined}
                            >
                                <FiPlus className={styles.icon} />
                                Создать
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.card}>


                <div className={styles.statsContainer}>
                    <h2 className={styles.statsTitle}>Статистика закупок</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.new}`}>{activePurchasesCount}</div>
                            <div className={styles.statLabel}>Активных закупок</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.inProgress}`}>{inTransitCount}</div>
                            <div className={styles.statLabel}>В пути</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.completed}`}>{formatCurrency(monthSum)}</div>
                            <div className={styles.statLabel}>Сумма в этом месяце</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.total}`}>{completedThisYearCount}</div>
                            <div className={styles.statLabel}>Завершено в этом году</div>
                        </div>
                    </div>
                </div>

                <div className={styles.tableActions}>
                    <TextField.Root
                        className={styles.searchInput}
                        size="3"
                        radius="large"
                        variant="surface"
                        placeholder="Поиск по закупкам..."
                        value={searchInputValue}
                        onChange={(e) => setSearchInputValue(e.target.value)}
                    >
                        <TextField.Slot side="left">
                            <FiSearch height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>

                    <div className={styles.filterGroup}>
                        <div className={styles.filterDropdown}>
                            <button
                                type="button"
                                ref={filterTriggerRef}
                                className={styles.filterSelectTrigger}
                                onClick={() => setIsFiltersOpen((v) => !v)}
                                aria-expanded={isFiltersOpen}
                            >
                                <span className={styles.triggerLabel}>
                                    <FiFilter className={styles.icon} />
                                    Фильтры
                                </span>
                            </button>

                            {isFiltersOpen ? (
                                <Box className={styles.filtersDropdownPanel} ref={filtersDropdownRef} data-purchases-filters-dropdown>
                                    <Tabs.Root defaultValue="status">
                                        <Tabs.List className={styles.filtersTabs}>
                                            <Tabs.Trigger value="status">Статус</Tabs.Trigger>
                                            <Tabs.Trigger value="supplier">Поставщик</Tabs.Trigger>
                                            <Tabs.Trigger value="order">Заявка</Tabs.Trigger>
                                        </Tabs.List>

                                        <Box pt="3">
                                            <Tabs.Content value="status">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Статус</Text>
                                                    <Select.Root
                                                        value={filters.status}
                                                        onOpenChange={setIsStatusSelectOpen}
                                                        onValueChange={(value) => {
                                                            setFilters((prev) => {
                                                                const next = { ...prev, status: value };
                                                                syncPurchasesUrl({
                                                                    status: next.status,
                                                                    supplierId: next.supplierId,
                                                                    supplierName: next.supplierName,
                                                                    orderId: next.orderId,
                                                                    sortBy: next.sortBy,
                                                                });
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast data-purchases-filters-select-content>
                                                            <Select.Item value="all">Все статусы</Select.Item>
                                                            <Select.Item value="заказано">Заказано</Select.Item>
                                                            <Select.Item value="в пути">В пути</Select.Item>
                                                            <Select.Item value="получено">Получено</Select.Item>
                                                            <Select.Item value="отменено">Отменено</Select.Item>
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="supplier">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Поставщик</Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="Начни вводить название поставщика…"
                                                        value={supplierQuery}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setSupplierQuery(v);
                                                            setFilters((prev) => ({
                                                                ...prev,
                                                                supplierName: v,
                                                                supplierId: v.trim() ? prev.supplierId : 'all',
                                                            }));

                                                            if (!v.trim()) {
                                                                syncPurchasesUrl({
                                                                    status: filters.status,
                                                                    supplierId: 'all',
                                                                    supplierName: '',
                                                                    orderId: filters.orderId,
                                                                    sortBy: filters.sortBy,
                                                                });
                                                            }
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />
                                                    {supplierQuery.trim() ? (
                                                        <div className={styles.inlineSuggestList}>
                                                            {filteredSupplierOptions.length === 0 ? (
                                                                <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                            ) : (
                                                                filteredSupplierOptions.slice(0, 10).map((s) => (
                                                                    <button
                                                                        key={s.id}
                                                                        type="button"
                                                                        className={styles.inlineSuggestItem}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            setSupplierQuery(s.name);
                                                                            setFilters((prev) => ({ ...prev, supplierId: String(s.id), supplierName: s.name }));
                                                                            syncPurchasesUrl({
                                                                                status: filters.status,
                                                                                supplierId: String(s.id),
                                                                                supplierName: s.name,
                                                                                orderId: filters.orderId,
                                                                                sortBy: filters.sortBy,
                                                                            });
                                                                        }}
                                                                    >
                                                                        {s.name}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="order">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Заявка (ID)</Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="Например: 23"
                                                        value={filters.orderId}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setFilters((prev) => {
                                                                const next = { ...prev, orderId: v };
                                                                syncPurchasesUrl({
                                                                    status: next.status,
                                                                    supplierId: next.supplierId,
                                                                    supplierName: next.supplierName,
                                                                    orderId: next.orderId,
                                                                    sortBy: next.sortBy,
                                                                });
                                                                return next;
                                                            });
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />
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
                                                setSupplierQuery('');
                                                setFilters((prev) => ({
                                                    ...prev,
                                                    status: 'all',
                                                    supplierId: 'all',
                                                    supplierName: '',
                                                    orderId: '',
                                                }));
                                                syncPurchasesUrl({ status: 'all', supplierId: 'all', supplierName: '', orderId: '', sortBy: filters.sortBy });
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
                                onOpenChange={(open) => {
                                    if (!open) {
                                        sortTriggerRef.current?.blur();
                                        (document.activeElement as HTMLElement | null)?.blur?.();
                                    }
                                }}
                                onValueChange={(value) => {
                                    setFilters((prev) => {
                                        const next = { ...prev, sortBy: value };
                                        syncPurchasesUrl({
                                            status: next.status,
                                            supplierId: next.supplierId,
                                            supplierName: next.supplierName,
                                            orderId: next.orderId,
                                            sortBy: next.sortBy,
                                        });
                                        return next;
                                    });
                                    sortTriggerRef.current?.blur();
                                    (document.activeElement as HTMLElement | null)?.blur?.();
                                }}
                            >
                                <Select.Trigger
                                    className={styles.sortSelectTrigger}
                                    ref={sortTriggerRef}
                                    variant="surface"
                                    color="gray"
                                />
                                <Select.Content position="popper" variant="solid" color="gray" highContrast>
                                    <Select.Item value="date-desc">По дате (новые сначала)</Select.Item>
                                    <Select.Item value="date-asc">По дате (старые сначала)</Select.Item>
                                    <Select.Item value="sum-asc">По сумме (по возрастанию)</Select.Item>
                                    <Select.Item value="sum-desc">По сумме (по убыванию)</Select.Item>
                                </Select.Content>
                            </Select.Root>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingSpinner}></div>
                        <p>Загрузка закупок...</p>
                    </div>
                ) : error ? (
                    <div className={styles.errorState}>
                        <p className={styles.errorText}>{error}</p>
                        <button className={`${styles.button} ${styles.primaryButton}`} onClick={fetchPurchases}>
                            Повторить попытку
                        </button>
                    </div>
                ) : purchases.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>Закупки не найдены</p>
                        {canCreate ? (
                            <button className={`${styles.button} ${styles.primaryButton}`} onClick={handleCreatePurchase}>
                                <FiPlus className={styles.icon} />
                                Создать первую закупку
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className={styles.tableContainer} key={tableKey}>
                        {isFetching ? <div className={styles.tableFetchingOverlay} /> : null}
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Поставщик</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Дата заказа</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Дата поступления</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={`${styles.textRight} ${styles.sumColumn}`}>
                                        <div className={styles.sumColumnInner}>Сумма</div>
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                <AnimatePresence>
                                    {purchases.map((purchase) => {
                                        const canMenuView = canView;
                                        const canMenuEdit = canEdit;
                                        const canMenuDelete = canDelete;
                                        const canMenuOpenOrder = canOrderView && canPurchaseOrderView && Boolean(purchase.заявка_id);
                                        const hasAnyMenuAction = canMenuView || canMenuEdit || canMenuOpenOrder || canMenuDelete;

                                        return (
                                            <MotionTableRow
                                                key={purchase.id}
                                                className={styles.tableRow}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                transition={{ duration: 0.2 }}
                                                onClick={canView ? () => handlePurchaseClick(purchase.id) : undefined}
                                            >
                                                <Table.Cell className={styles.tableCell}>
                                                    <div>
                                                        <span className={styles.orderId}>#{purchase.id}</span>
                                                        {canAttachmentsView ? renderAttachmentBadges(purchase.id) : null}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    <div className={styles.clientCell}>
                                                        <div className={styles.clientName}>{purchase.поставщик_название || `Поставщик #${purchase.поставщик_id}`}</div>
                                                        {purchase.поставщик_телефон ? (
                                                            <div className={styles.clientMeta}>{purchase.поставщик_телефон}</div>
                                                        ) : null}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    {purchase.заявка_id ? `#${purchase.заявка_id}` : 'Не указана'}
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    <div className={styles.dateCell}>{formatDateTime(purchase.дата_заказа)}</div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    <div className={styles.dateCell}>
                                                        {purchase.дата_поступления ? formatDate(purchase.дата_поступления) : 'Не указана'}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    <div
                                                        className={styles.statusBadge}
                                                        style={{
                                                            backgroundColor: `${getStatusColor(purchase.статус)}15`,
                                                            color: getStatusColor(purchase.статус),
                                                            border: `1px solid ${getStatusColor(purchase.статус)}40`,
                                                        }}
                                                    >
                                                        {purchase.статус}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                                                    <div className={styles.sumColumnInner}>{formatCurrency(purchase.общая_сумма)}</div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.tableCell}>
                                                    <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                        {hasAnyMenuAction ? (
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger>
                                                                    <button
                                                                        type="button"
                                                                        className="menuButton"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        aria-label="Меню"
                                                                        title="Действия"
                                                                    >
                                                                        <FiMoreHorizontal size={18} />
                                                                    </button>
                                                                </DropdownMenu.Trigger>
                                                                <DropdownMenu.Content align="end" sideOffset={6}>
                                                                    {canMenuView ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                handlePurchaseClick(purchase.id);
                                                                            }}
                                                                        >
                                                                            <FiEye className={styles.rowMenuIcon} />
                                                                            Посмотреть
                                                                        </DropdownMenu.Item>
                                                                    ) : null}

                                                                    {canMenuEdit ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                setSelectedPurchase(purchase);
                                                                                setIsEditModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <FiEdit2 className={styles.rowMenuIcon} />
                                                                            Редактировать
                                                                        </DropdownMenu.Item>
                                                                    ) : null}

                                                                    {canMenuOpenOrder ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                handleOpenOrder(purchase);
                                                                            }}
                                                                        >
                                                                            <FiEye className={styles.rowMenuIcon} />
                                                                            Открыть заявку
                                                                        </DropdownMenu.Item>
                                                                    ) : null}

                                                                    {canMenuDelete ? (
                                                                        <>
                                                                            {canMenuView || canMenuEdit || canMenuOpenOrder ? <DropdownMenu.Separator /> : null}
                                                                            <DropdownMenu.Item
                                                                                color="red"
                                                                                className={styles.rowMenuItemDanger}
                                                                                onSelect={(e) => {
                                                                                    e?.preventDefault?.();
                                                                                    setSelectedPurchase(purchase);
                                                                                    setIsDeleteConfirmOpen(true);
                                                                                }}
                                                                            >
                                                                                <FiTrash2 className={styles.rowMenuIconDel} />
                                                                                Удалить
                                                                            </DropdownMenu.Item>
                                                                        </>
                                                                    ) : null}
                                                                </DropdownMenu.Content>
                                                            </DropdownMenu.Root>
                                                        ) : null}
                                                    </div>
                                                </Table.Cell>
                                            </MotionTableRow>
                                        );
                                    })}
                                </AnimatePresence>
                            </Table.Body>
                        </Table.Root>
                    </div>
                )}

                {/* Modal Components */}
                <EditPurchaseModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedPurchase(null);
                    }}
                    onSubmit={handleEditPurchase}
                    purchase={selectedPurchase as any}
                />

                <Dialog.Root
                    open={isDeleteConfirmOpen && !!selectedPurchase}
                    onOpenChange={(open) => {
                        if (!open) {
                            setIsDeleteConfirmOpen(false);
                            setSelectedPurchase(null);
                        }
                    }}
                >
                    <Dialog.Content className={deleteConfirmationStyles.modalContent}>
                        <Dialog.Title>Подтверждение удаления</Dialog.Title>
                        <Box className={deleteConfirmationStyles.form}>
                            <Flex direction="column" gap="3">
                                <Text as="div" size="2" color="gray">
                                    Вы уверены, что хотите удалить эту закупку? Это действие нельзя отменить.
                                </Text>

                                {selectedPurchase ? (
                                    <Box className={deleteConfirmationStyles.positionsSection}>
                                        <Flex direction="column" gap="1">
                                            <Text as="div" weight="bold">Закупка #{selectedPurchase.id}</Text>
                                            <Text as="div" size="2" color="gray">Сумма: {formatCurrency(selectedPurchase.общая_сумма || 0)}</Text>
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
                                            setIsDeleteConfirmOpen(false);
                                            setSelectedPurchase(null);
                                        }}
                                        disabled={operationLoading}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="surface"
                                        color="red"
                                        highContrast
                                        className={deleteConfirmationStyles.modalDeleteButton}
                                        onClick={handleDeletePurchaseConfirm}
                                        disabled={operationLoading}
                                    >
                                        {operationLoading ? 'Удаление...' : 'Удалить'}
                                    </Button>
                                </Flex>
                            </Flex>
                        </Box>
                    </Dialog.Content>
                </Dialog.Root>

                {/* Create Purchase Modal */}
                {showCreateModal ? (
                    <CreatePurchaseModal
                        key={`purchases-index-create-${createPurchaseModalKey}`}
                        isOpen={showCreateModal}
                        onClose={() => {
                            setShowCreateModal(false);
                            setSelectedSupplier(null);
                        }}
                        onPurchaseCreated={() => {
                            setShowCreateModal(false);
                            setSelectedSupplier(null);
                            fetchPurchases();
                        }}
                        заявка_id={order_id ? Number(order_id) : undefined}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default withLayout(PurchasesPage);
