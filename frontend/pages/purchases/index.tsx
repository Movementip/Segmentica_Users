import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import { CreateEntityButton } from '@/components/CreateEntityButton/CreateEntityButton';
import { EntityTableSkeleton, EntityTableSurface } from '@/components/EntityDataTable/EntityDataTable';
import DeleteConfirmation from '@/components/modals/DeleteConfirmation/DeleteConfirmation';
import { CreatePurchaseModal } from '@/components/modals/CreatePurchaseModal/CreatePurchaseModal';
import EditPurchaseModal from '@/components/modals/EditPurchaseModal/EditPurchaseModal';
import { OrderAttachmentBadges } from '@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges';
import { PurchasesFilters } from '@/components/purchases/PurchasesFilters/PurchasesFilters';
import { PurchasesPageHeader } from '@/components/purchases/PurchasesPageHeader/PurchasesPageHeader';
import { PurchasesPageSkeleton } from '@/components/purchases/PurchasesPageSkeleton/PurchasesPageSkeleton';
import { PurchasesStats } from '@/components/purchases/PurchasesStats/PurchasesStats';
import { PurchasesTable } from '@/components/purchases/PurchasesTable/PurchasesTable';
import type {
    AttachmentSummaryItem,
    Purchase,
    PurchasesFiltersState,
    Supplier,
    SupplierOption,
} from '@/components/purchases/types';
import { NoAccessPage } from '@/components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '@/components/ui/PageLoader/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { withLayout } from '@/layout';

import deleteConfirmationStyles from '../../components/modals/DeleteConfirmation/DeleteConfirmation.module.css';
import styles from './Purchases.module.css';

function PurchasesPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { order_id } = router.query;

    const canList = Boolean(user?.permissions?.includes('purchases.list'));
    const canView = Boolean(user?.permissions?.includes('purchases.view'));
    const canCreate = Boolean(user?.permissions?.includes('purchases.create'));
    const canEdit = Boolean(user?.permissions?.includes('purchases.edit'));
    const canDelete = Boolean(user?.permissions?.includes('purchases.delete'));
    const canOrderView = Boolean(user?.permissions?.includes('orders.view'));
    const canPurchaseOrderView = Boolean(user?.permissions?.includes('purchases.order.view'));
    const canAttachmentsView = Boolean(user?.permissions?.includes('purchases.attachments.view'));

    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0);

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
    const lastSyncedSupplierIdRef = useRef<string>('all');

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [supplierQuery, setSupplierQuery] = useState('');
    const [filters, setFilters] = useState<PurchasesFiltersState>({
        status: 'all',
        supplierId: 'all',
        supplierName: '',
        orderId: '',
        sortBy: 'date-desc',
    });

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const timer = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(timer);
    }, [minRefreshSpinActive]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchInputValue);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInputValue]);

    const syncPurchasesUrl = useCallback((next: {
        status: string;
        supplierId: string;
        supplierName: string;
        orderId: string;
        sortBy: string;
    }) => {
        const query = { ...router.query } as Record<string, string | string[] | undefined>;

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
    }, [router]);

    useEffect(() => {
        if (!router.isReady) return;

        const statusRaw = router.query.status;
        const supplierIdRaw = router.query.supplier_id;
        const supplierNameRaw = router.query.supplier;
        const orderIdRaw = router.query.order_id;
        const sortRaw = router.query.sort;

        const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const supplierId = Array.isArray(supplierIdRaw) ? supplierIdRaw[0] : supplierIdRaw;
        const supplierName = Array.isArray(supplierNameRaw) ? supplierNameRaw[0] : supplierNameRaw;
        const orderIdFromQuery = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
        const sort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        setFilters((previous) => ({
            ...previous,
            status: status ? String(status) : previous.status,
            supplierId: supplierId ? String(supplierId) : previous.supplierId,
            supplierName: supplierName ? String(supplierName) : previous.supplierName,
            orderId: orderIdFromQuery ? String(orderIdFromQuery) : previous.orderId,
            sortBy: sort ? String(sort) : previous.sortBy,
        }));

        if (supplierName) setSupplierQuery(String(supplierName));
    }, [
        router.isReady,
        router.query.order_id,
        router.query.sort,
        router.query.status,
        router.query.supplier,
        router.query.supplier_id,
    ]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((event.target as Node | null) && filtersDropdownRef.current?.contains(event.target as Node));
            const targetElement = event.target instanceof Element ? event.target : null;
            const isInsideSelectPortal = Boolean(
                targetElement?.closest('[data-slot="select-content"], [data-slot="select-item"]')
            );

            if (isInsideDropdown || isInsideSelectPortal) return;

            setIsFiltersOpen(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isFiltersOpen]);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/suppliers');

            if (!response.ok) {
                throw new Error('Ошибка загрузки поставщиков');
            }

            const data = await response.json();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (fetchError) {
            console.error('Error fetching suppliers:', fetchError);
        }
    };

    const fetchPurchases = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/purchases');

            if (!response.ok) {
                throw new Error('Ошибка загрузки закупок');
            }

            const rawData = await response.json();
            const rawPurchases: Purchase[] = Array.isArray(rawData) ? rawData : [];
            setAllPurchases(rawPurchases);

            let data = [...rawPurchases];

            if (debouncedSearchQuery) {
                const query = debouncedSearchQuery.trim().toLowerCase();
                data = data.filter((purchase) => (
                    String(purchase.id).includes(query) ||
                    String(purchase.заявка_id ?? '').includes(query) ||
                    (purchase.поставщик_название || '').toLowerCase().includes(query) ||
                    (purchase.поставщик_телефон || '').toLowerCase().includes(query) ||
                    (purchase.статус || '').toLowerCase().includes(query)
                ));
            }

            if (order_id) {
                const orderIdNumber = Number(order_id);
                if (!Number.isNaN(orderIdNumber)) {
                    data = data.filter((purchase) => Number(purchase.заявка_id) === orderIdNumber);
                }
            }

            if (filters.status !== 'all') {
                data = data.filter((purchase) => (purchase.статус || '').toLowerCase() === filters.status);
            }

            if (filters.supplierId !== 'all') {
                data = data.filter((purchase) => String(purchase.поставщик_id) === String(filters.supplierId));
            }

            if (filters.supplierName.trim()) {
                const supplierName = filters.supplierName.trim().toLowerCase();
                data = data.filter((purchase) => (
                    purchase.поставщик_название || ''
                ).toLowerCase().includes(supplierName));
            }

            if (filters.orderId.trim()) {
                const rawOrderFilter = filters.orderId.trim();
                const normalizedOrderFilter = rawOrderFilter.replace(/^#/, '').trim();
                const orderFilterNumber = Number(normalizedOrderFilter);

                data = data.filter((purchase) => {
                    const purchaseOrderId = purchase.заявка_id;
                    if (purchaseOrderId === null || purchaseOrderId === undefined) return false;

                    if (!Number.isNaN(orderFilterNumber) && normalizedOrderFilter !== '') {
                        return Number(purchaseOrderId) === orderFilterNumber;
                    }

                    return String(purchaseOrderId).toLowerCase().includes(normalizedOrderFilter.toLowerCase());
                });
            }

            const nextPurchases = [...data].sort((left, right) => {
                switch (filters.sortBy) {
                    case 'sum-asc':
                        return (left.общая_сумма || 0) - (right.общая_сумма || 0);
                    case 'sum-desc':
                        return (right.общая_сумма || 0) - (left.общая_сумма || 0);
                    case 'date-asc':
                        return new Date(left.дата_заказа).getTime() - new Date(right.дата_заказа).getTime();
                    case 'date-desc':
                    default:
                        return new Date(right.дата_заказа).getTime() - new Date(left.дата_заказа).getTime();
                }
            });

            setPurchases(nextPurchases);

            const ids = nextPurchases
                .map((purchase) => Number(purchase.id))
                .filter((value) => Number.isInteger(value) && value > 0);

            if (canAttachmentsView && ids.length > 0) {
                try {
                    const summaryResponse = await fetch(
                        `/api/attachments/summary?entity_type=purchase&entity_ids=${encodeURIComponent(ids.join(','))}`
                    );

                    if (summaryResponse.ok) {
                        const summaryData = (await summaryResponse.json()) as AttachmentSummaryItem[];
                        const nextMap: Record<number, string[]> = {};

                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            nextMap[key] = Array.isArray(item.types) ? item.types : [];
                        }

                        setAttachmentsTypesByPurchaseId(nextMap);
                    }
                } catch (summaryError) {
                    console.error('Error fetching purchases attachments summary:', summaryError);
                }
            } else {
                setAttachmentsTypesByPurchaseId({});
            }
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    }, [canAttachmentsView, debouncedSearchQuery, filters, order_id]);

    useEffect(() => {
        if (authLoading || !canList || !router.isReady) return;
        void fetchPurchases();
    }, [authLoading, canList, router.isReady, fetchPurchases]);

    useEffect(() => {
        if (authLoading || !canList) return;
        void fetchSuppliers();
    }, [authLoading, canList]);

    const supplierOptions = useMemo((): SupplierOption[] => {
        const map = new Map<number, string>();

        for (const purchase of allPurchases) {
            const name = (purchase.поставщик_название || '').trim();
            if (!purchase.поставщик_id || !name) continue;
            if (!map.has(purchase.поставщик_id)) {
                map.set(purchase.поставщик_id, name);
            }
        }

        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    }, [allPurchases]);

    const filteredSupplierOptions = useMemo(() => {
        const query = supplierQuery.trim().toLowerCase();
        if (!query) return supplierOptions;
        return supplierOptions.filter((supplier) => supplier.name.toLowerCase().includes(query));
    }, [supplierOptions, supplierQuery]);

    useEffect(() => {
        if (!router.isReady) return;
        if (!suppliers.length) return;
        if (!filters.supplierId || filters.supplierId === 'all') return;
        if (filters.supplierName.trim()) return;

        const match = suppliers.find((supplier) => String(supplier.id) === String(filters.supplierId));
        if (!match) return;

        setSupplierQuery(match.название);
        setFilters((previous) => ({ ...previous, supplierName: match.название }));
        syncPurchasesUrl({
            status: filters.status,
            supplierId: String(filters.supplierId),
            supplierName: '',
            orderId: filters.orderId,
            sortBy: filters.sortBy,
        });
    }, [
        router.isReady,
        suppliers,
        filters.supplierId,
        filters.supplierName,
        filters.status,
        filters.orderId,
        filters.sortBy,
        syncPurchasesUrl,
    ]);

    useEffect(() => {
        if (filters.supplierId === lastSyncedSupplierIdRef.current) return;

        lastSyncedSupplierIdRef.current = filters.supplierId;

        if (filters.supplierId === 'all') {
            setSupplierQuery('');
            return;
        }

        const match = supplierOptions.find((supplier) => String(supplier.id) === String(filters.supplierId));
        if (match) {
            setSupplierQuery(match.name);
            setFilters((previous) => ({ ...previous, supplierName: match.name }));
        }
    }, [filters.supplierId, supplierOptions]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
        }).format(amount);
    };

    const handleCreatePurchase = () => {
        if (!canCreate) {
            setError('Нет доступа');
            return;
        }

        if (suppliers.length > 0) {
            setCreatePurchaseModalKey((previous) => previous + 1);
            setShowCreateModal(true);
            return;
        }

        window.alert('Сначала добавьте поставщиков в систему');
    };

    const handleEditPurchase = async (purchaseData: Record<string, unknown> & { id: number }) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }

            setOperationLoading(true);
            const response = await fetch(`/api/purchases?id=${purchaseData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления закупки');
            }

            await fetchPurchases();
            setIsEditModalOpen(false);
            setSelectedPurchase(null);
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Ошибка обновления закупки');
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
            const response = await fetch(`/api/purchases?id=${selectedPurchase.id}`, { method: 'DELETE' });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка удаления закупки');
            }

            await fetchPurchases();
            setIsDeleteConfirmOpen(false);
            setSelectedPurchase(null);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Ошибка удаления закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    const activePurchasesCount = useMemo(() => {
        return allPurchases.filter((purchase) => {
            const status = (purchase.статус || '').toLowerCase();
            return status !== 'получено' && status !== 'отменено';
        }).length;
    }, [allPurchases]);

    const inTransitCount = useMemo(() => {
        return allPurchases.filter((purchase) => (purchase.статус || '').toLowerCase() === 'в пути').length;
    }, [allPurchases]);

    const monthSum = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();

        return allPurchases.reduce((sum, purchase) => {
            const date = purchase.дата_заказа ? new Date(purchase.дата_заказа) : null;
            if (!date || Number.isNaN(date.getTime())) return sum;
            if (date.getMonth() !== month || date.getFullYear() !== year) return sum;
            return sum + (Number(purchase.общая_сумма) || 0);
        }, 0);
    }, [allPurchases]);

    const completedThisYearCount = useMemo(() => {
        const year = new Date().getFullYear();

        return allPurchases.filter((purchase) => {
            if ((purchase.статус || '').toLowerCase() !== 'получено') return false;
            const rawDate = purchase.дата_поступления || purchase.дата_заказа;
            if (!rawDate) return false;
            const date = new Date(rawDate);
            if (Number.isNaN(date.getTime())) return false;
            return date.getFullYear() === year;
        }).length;
    }, [allPurchases]);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <PurchasesPageHeader
                canCreate={canCreate}
                isRefreshing={loading || isFetching || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                onRefresh={() => {
                    setIsFetching(true);
                    setTableKey((value) => value + 1);
                    setRefreshClickKey((value) => value + 1);
                    setMinRefreshSpinActive(true);
                    void fetchPurchases();
                }}
                onCreate={handleCreatePurchase}
            />

            {loading && purchases.length === 0 ? (
                <PurchasesPageSkeleton />
            ) : (
                <div className={styles.card}>
                    <PurchasesStats
                        activePurchasesCount={activePurchasesCount}
                        inTransitCount={inTransitCount}
                        monthSum={monthSum}
                        completedThisYearCount={completedThisYearCount}
                        formatCurrency={formatCurrency}
                    />

                    <PurchasesFilters
                        searchInputValue={searchInputValue}
                        onSearchInputChange={setSearchInputValue}
                        isFiltersOpen={isFiltersOpen}
                        setIsFiltersOpen={setIsFiltersOpen}
                        filters={filters}
                        setFilters={setFilters}
                        syncPurchasesUrl={syncPurchasesUrl}
                        supplierQuery={supplierQuery}
                        setSupplierQuery={setSupplierQuery}
                        filteredSupplierOptions={filteredSupplierOptions}
                        filtersDropdownRef={filtersDropdownRef}
                        filterTriggerRef={filterTriggerRef}
                        sortTriggerRef={sortTriggerRef}
                    />

                    {loading ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableContainer} key={tableKey}>
                            <EntityTableSkeleton columns={7} rows={7} actionColumn />
                        </EntityTableSurface>
                    ) : error ? (
                        <div className={styles.errorState}>
                            <p className={styles.errorText}>{error}</p>
                            <button className={styles.button} onClick={() => { void fetchPurchases(); }}>
                                Повторить попытку
                            </button>
                        </div>
                    ) : purchases.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Закупки не найдены</p>
                            {canCreate ? (
                                <CreateEntityButton
                                    className={styles.button}
                                    onClick={handleCreatePurchase}
                                >
                                    Создать первую закупку
                                </CreateEntityButton>
                            ) : null}
                        </div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableContainer} key={tableKey}>
                            <PurchasesTable
                                purchases={purchases}
                                canView={canView}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                canOpenOrderForPurchase={(purchase) => (
                                    canOrderView &&
                                    canPurchaseOrderView &&
                                    Boolean(purchase.заявка_id)
                                )}
                                formatDate={formatDate}
                                formatDateTime={formatDateTime}
                                formatCurrency={formatCurrency}
                                renderAttachmentBadges={(purchaseId) => (
                                    canAttachmentsView
                                        ? <OrderAttachmentBadges types={attachmentsTypesByPurchaseId[purchaseId] || []} />
                                        : null
                                )}
                                onOpenPurchase={(purchase) => {
                                    if (!canView) return;
                                    void router.push(`/purchases/${purchase.id}`);
                                }}
                                onEditPurchase={(purchase) => {
                                    setSelectedPurchase(purchase);
                                    setIsEditModalOpen(true);
                                }}
                                onOpenOrder={(purchase) => {
                                    if (!purchase.заявка_id) return;
                                    void router.push(`/orders/${purchase.заявка_id}`);
                                }}
                                onDeletePurchase={(purchase) => {
                                    setSelectedPurchase(purchase);
                                    setIsDeleteConfirmOpen(true);
                                }}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}

            <EditPurchaseModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedPurchase(null);
                }}
                onSubmit={handleEditPurchase}
                purchase={selectedPurchase}
            />

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => {
                    setIsDeleteConfirmOpen(false);
                    setSelectedPurchase(null);
                }}
                onConfirm={handleDeletePurchaseConfirm}
                loading={operationLoading}
                title="Подтверждение удаления"
                message="Вы уверены, что хотите удалить эту закупку?"
                warning="Это действие нельзя отменить. Все данные закупки и связанные позиции будут удалены."
                details={selectedPurchase ? (
                    <div className={deleteConfirmationStyles.positionsSection}>
                        <div className={deleteConfirmationStyles.orderTitle}>Закупка #{selectedPurchase.id}</div>
                        {selectedPurchase.поставщик_название ? (
                            <div className={deleteConfirmationStyles.orderMeta}>
                                Поставщик: {selectedPurchase.поставщик_название}
                            </div>
                        ) : null}
                        <div className={deleteConfirmationStyles.orderMeta}>
                            Сумма: {formatCurrency(selectedPurchase.общая_сумма || 0)}
                        </div>
                    </div>
                ) : null}
            />

            {showCreateModal ? (
                <CreatePurchaseModal
                    key={`purchases-index-create-${createPurchaseModalKey}`}
                    isOpen={showCreateModal}
                    onClose={() => {
                        setShowCreateModal(false);
                    }}
                    onPurchaseCreated={() => {
                        setShowCreateModal(false);
                        void fetchPurchases();
                    }}
                    заявка_id={order_id ? Number(order_id) : undefined}
                />
            ) : null}
        </div>
    );
}

export default withLayout(PurchasesPage);
