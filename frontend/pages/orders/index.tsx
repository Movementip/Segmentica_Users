import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import CreateOrderModal from '../../components/modals/CreateOrderModal/CreateOrderModal';
import EditOrderModal from '../../components/modals/EditOrderModal/EditOrderModal';
import { CreatePurchaseModal, type OrderPositionSnapshot } from '../../components/modals/CreatePurchaseModal/CreatePurchaseModal';
import { CreateShipmentModal } from '../../components/modals/CreateShipmentModal/CreateShipmentModal';
import { OrderWorkflowModal, type OrderWorkflowModalSummary } from '../../components/modals/OrderWorkflowModal/OrderWorkflowModal';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import styles from './Orders.module.css';
import { useAuth } from '../../hooks/use-auth';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import { Button } from '../../components/ui/button';
import { OrderAttachmentBadges } from '../../components/orders/OrderAttachmentBadges/OrderAttachmentBadges';
import { DeleteBlockedDialog } from '../../components/orders/DeleteBlockedDialog/DeleteBlockedDialog';
import { CreateEntityButton } from '../../components/CreateEntityButton/CreateEntityButton';
import { EntityTableSkeleton, EntityTableSurface } from '../../components/EntityDataTable/EntityDataTable';
import { OrdersFilters } from '../../components/orders/OrdersFilters/OrdersFilters';
import { OrdersPageHeader } from '../../components/orders/OrdersPageHeader/OrdersPageHeader';
import { OrdersPageSkeleton } from '../../components/orders/OrdersPageSkeleton/OrdersPageSkeleton';
import { OrdersStats } from '../../components/orders/OrdersStats/OrdersStats';
import { OrdersTable } from '../../components/orders/OrdersTable/OrdersTable';
import type { AttachmentSummaryItem, ClientOption, LinkedPurchase, Order } from '../../types/pages/orders';
import { formatRuCurrency, formatRuDateTime } from '../../utils/formatters';

function OrdersPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { client_id } = router.query;
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<{ purchases: LinkedPurchase[]; movementsCount: number } | null>(null);
    const [isDeleteBlockedOpen, setIsDeleteBlockedOpen] = useState(false);

    // Refs
    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const sortTriggerRef = useRef<HTMLButtonElement>(null);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreatePurchaseOpen, setIsCreatePurchaseOpen] = useState(false);
    const [createPurchaseModalKey, setCreatePurchaseModalKey] = useState(0);
    const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowError, setWorkflowError] = useState<string | null>(null);
    const [workflowSummary, setWorkflowSummary] = useState<OrderWorkflowModalSummary | null>(null);
    const [createPurchaseOrderPositions, setCreatePurchaseOrderPositions] = useState<OrderPositionSnapshot[]>([]);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    const [attachmentsTypesByOrderId, setAttachmentsTypesByOrderId] = useState<Record<number, string[]>>({});

    const [tableKey, setTableKey] = useState(0);
    const [refreshClickKey, setRefreshClickKey] = useState(0);

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);

    const [clientQuery, setClientQuery] = useState('');
    const [managerQuery, setManagerQuery] = useState('');
    const lastSyncedClientIdRef = useRef<string>('all');

    // Filters state
    const [filters, setFilters] = useState({
        status: 'all',
        executionMode: 'all',
        sortBy: 'date-desc',
        clientId: 'all',
        managerName: '',
        clientName: '',
    });

    const syncOrdersUrl = (next: { clientId: string; status: string; executionMode: string; managerName: string; sortBy: string }) => {
        const query = { ...router.query } as Record<string, any>;

        if (next.clientId && next.clientId !== 'all') query.client_id = String(next.clientId);
        else delete query.client_id;

        if (next.status && next.status !== 'all') query.status = String(next.status);
        else delete query.status;

        if (next.executionMode && next.executionMode !== 'all') query.execution_mode = String(next.executionMode);
        else delete query.execution_mode;

        if ((next.managerName || '').trim()) query.manager = String(next.managerName).trim();
        else delete query.manager;

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
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((e.target as Node | null) && filtersDropdownRef.current?.contains(e.target as Node));
            const targetElement = e.target instanceof Element ? e.target : null;
            const isInsideSelectPortal = Boolean(
                targetElement?.closest('[data-slot="select-content"], [data-slot="select-item"]')
            );

            if (isInsideDropdown || isInsideSelectPortal) return;

            setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [isFiltersOpen]);

    useEffect(() => {
        if (!router.isReady) return;
        const cidRaw = router.query.client_id;
        const statusRaw = router.query.status;
        const executionModeRaw = router.query.execution_mode;
        const managerRaw = router.query.manager;
        const sortRaw = router.query.sort;

        const cid = Array.isArray(cidRaw) ? cidRaw[0] : cidRaw;
        const st = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const em = Array.isArray(executionModeRaw) ? executionModeRaw[0] : executionModeRaw;
        const mg = Array.isArray(managerRaw) ? managerRaw[0] : managerRaw;
        const sr = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        setFilters((prev) => ({
            ...prev,
            clientId: cid ? String(cid) : 'all',
            status: st ? String(st) : prev.status,
            executionMode: em ? String(em) : 'all',
            managerName: mg ? String(mg) : prev.managerName,
            sortBy: sr ? String(sr) : prev.sortBy,
        }));

        if (mg) {
            setManagerQuery(String(mg));
        }
    }, [router.isReady]);

    const clientOptions = React.useMemo((): ClientOption[] => {
        const map = new Map<number, string>();
        for (const o of orders) {
            if (!o.клиент_id) continue;
            const name = o.клиент_название?.trim();
            if (!name) continue;
            if (!map.has(o.клиент_id)) map.set(o.клиент_id, name);
        }
        const res = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
        res.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return res;
    }, [orders]);

    const filteredClientOptions = React.useMemo((): ClientOption[] => {
        const q = clientQuery.trim().toLowerCase();
        if (!q) return clientOptions;
        return clientOptions.filter((c) => c.name.toLowerCase().includes(q));
    }, [clientOptions, clientQuery]);

    useEffect(() => {
        if (!router.isReady) return;
        if (!client_id) return;

        const cid = Array.isArray(client_id) ? client_id[0] : client_id;
        if (!cid) return;

        if (clientOptions.length === 0) return;

        const match = clientOptions.find((c) => String(c.id) === String(cid));
        if (!match) return;

        setClientQuery(match.name);
        setFilters((prev) => ({ ...prev, clientId: String(match.id), clientName: match.name }));
    }, [router.isReady, client_id, clientOptions]);

    useEffect(() => {
        if (filters.clientId === lastSyncedClientIdRef.current) return;

        lastSyncedClientIdRef.current = filters.clientId;

        if (filters.clientId === 'all') {
            setClientQuery('');
            return;
        }

        const match = clientOptions.find((c) => String(c.id) === String(filters.clientId));
        if (match) {
            setClientQuery(match.name);
            setFilters((prev) => ({ ...prev, clientName: match.name }));
        }
    }, [clientOptions, clientQuery, filters.clientId]);

    const managerOptions = React.useMemo((): string[] => {
        const set = new Set<string>();
        for (const o of orders) {
            const name = (o.менеджер_фио || '').trim();
            if (!name) continue;
            set.add(name);
        }
        const res = Array.from(set.values());
        res.sort((a, b) => a.localeCompare(b, 'ru'));
        return res;
    }, [orders]);

    const filteredManagerOptions = React.useMemo((): string[] => {
        const q = managerQuery.trim().toLowerCase();
        if (!q) return managerOptions;
        return managerOptions.filter((name) => name.toLowerCase().includes(q));
    }, [managerOptions, managerQuery]);

    useEffect(() => {
        if (!filters.managerName) {
            if (managerQuery) setManagerQuery('');
            return;
        }
        if (filters.managerName !== managerQuery) {
            setManagerQuery(filters.managerName);
        }
    }, [filters.managerName, managerQuery]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFiltersOpen(false);
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isFiltersOpen]);

    const handleEditOrder = async (orderData: any) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления заявки');
            }

            await fetchOrders();
            setIsEditModalOpen(false);
            setSelectedOrder(null);
        } catch (err) {
            console.error('Error updating order:', err);
            setError(err instanceof Error ? err.message : 'Ошибка обновления заявки');
        } finally {
            setOperationLoading(false);
        }
    };

    const openEditModal = async (order: Order) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);

            const missingResponse = await fetch(`/api/missing-products?order_id=${order.id}`);
            let missingProducts = order.недостающие_товары;

            if (missingResponse.ok) {
                missingProducts = await missingResponse.json();
            }

            setSelectedOrder({
                ...order,
                недостающие_товары: missingProducts,
            });
            setIsEditModalOpen(true);
        } catch (err) {
            console.error('Error loading order shortages for edit modal:', err);
            setSelectedOrder(order);
            setIsEditModalOpen(true);
        } finally {
            setOperationLoading(false);
        }
    };

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchInputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInputValue]);

    // Fetch orders on initial load and when debounced search or filters change
    const canList = Boolean(user?.permissions?.includes('orders.list'));
    const canView = Boolean(user?.permissions?.includes('orders.view'));
    const canCreate = Boolean(user?.permissions?.includes('orders.create'));
    const canEdit = Boolean(user?.permissions?.includes('orders.edit'));
    const canDelete = Boolean(user?.permissions?.includes('orders.delete'));
    const canCreatePurchaseFromOrdersMenu = Boolean(user?.permissions?.includes('orders.purchases.create'));
    const canCreatePurchase = Boolean(user?.permissions?.includes('purchases.create'));
    const canCreatePurchaseFromOrders = canCreatePurchaseFromOrdersMenu && canCreatePurchase;
    const canCreateShipment = Boolean(user?.permissions?.includes('shipments.create'));

    const hasRowActions = canView || canEdit || canDelete || canCreatePurchaseFromOrders || canCreateShipment;

    const normalizeOrderStatus = (status?: string | null) => (status || '').trim().toLowerCase();
    const canCreatePurchaseForOrder = (order: Order) => {
        if (typeof order.can_create_purchase === 'boolean') {
            return canCreatePurchaseFromOrders && order.can_create_purchase;
        }
        const status = normalizeOrderStatus(order.статус);
        return canCreatePurchaseFromOrders && !['собрана', 'отгружена', 'выполнена', 'отменена'].includes(status);
    };
    const canAssembleForOrder = (order: Order) => canEdit && Boolean(order.can_assemble);
    const canCompleteForOrder = (order: Order) => canEdit && Boolean(order.can_complete) && normalizeOrderStatus(order.статус) !== 'выполнена';
    const canCreateShipmentForOrder = (order: Order) => {
        if (typeof order.can_create_shipment === 'boolean') {
            return canCreateShipment && order.can_create_shipment;
        }
        const status = normalizeOrderStatus(order.статус);
        return canCreateShipment && status === 'собрана';
    };
    const getAssembleLabel = (order: Order) => order.next_assembly_label || 'Собрать заявку';
    const getShipmentLabel = (order: Order) => order.next_shipment_label || 'Создать отгрузку';

    const openCreatePurchaseForOrder = async (order: Order) => {
        try {
            setOperationLoading(true);
            setError(null);

            const shouldUseDirectPositions = order.режим_исполнения === 'direct';
            const [orderResponse, missingResponse] = await Promise.all([
                fetch(`/api/orders/${order.id}`),
                shouldUseDirectPositions ? Promise.resolve(null) : fetch(`/api/missing-products?order_id=${order.id}`),
            ]);

            const orderData = await orderResponse.json().catch(() => ({}));
            const missingData = missingResponse ? await missingResponse.json().catch(() => ([])) : [];

            if (!orderResponse.ok) {
                throw new Error((orderData as any)?.error || 'Не удалось загрузить позиции заявки');
            }

            if (missingResponse && !missingResponse.ok) {
                throw new Error((missingData as any)?.error || 'Не удалось загрузить недостающие товары');
            }

            let directRemainingByProductId = new Map<number, number>();
            let warehouseRemainingByProductId = new Map<number, number>();
            {
                const workflowResponse = await fetch(`/api/orders/${order.id}/workflow`);
                const workflowData = await workflowResponse.json().catch(() => ({}));

                if (!workflowResponse.ok) {
                    throw new Error((workflowData as any)?.error || 'Не удалось загрузить workflow заявки');
                }

                directRemainingByProductId = new Map<number, number>(
                    ((workflowData as any)?.positions || []).map((item: any) => [
                        Number(item?.товар_id) || 0,
                        Number(item?.осталось_закупить) || 0,
                    ])
                );
                warehouseRemainingByProductId = new Map<number, number>(
                    ((workflowData as any)?.positions || []).map((item: any) => [
                        Number(item?.товар_id) || 0,
                        Math.max(
                            0,
                            (Number(item?.активная_недостача) || 0) - (Number(item?.закуплено_количество) || 0)
                        ),
                    ])
                );
            }

            const activeMissingPositions = shouldUseDirectPositions
                ? ((orderData as any)?.позиции || [])
                    .filter((item: any) => item?.способ_обеспечения === 'purchase')
                    .map((item: any) => ({
                        товар_id: Number(item.товар_id),
                        количество: directRemainingByProductId.get(Number(item.товар_id) || 0) || 0,
                        ндс_id: item?.ндс_id ?? undefined,
                        цена: Number(item?.цена) || 0,
                    }))
                    .filter((item: OrderPositionSnapshot) => item.товар_id > 0 && item.количество > 0)
                : (Array.isArray(missingData) ? missingData : [])
                    .filter((item: any) => item && Number(item.недостающее_количество) > 0 && item.статус !== 'получено')
                    .map((item: any) => {
                        const position = (orderData as any)?.позиции?.find((row: any) => Number(row.товар_id) === Number(item.товар_id));
                        return {
                            товар_id: Number(item.товар_id),
                            количество: warehouseRemainingByProductId.get(Number(item.товар_id) || 0) || 0,
                            ндс_id: position?.ндс_id ?? undefined,
                            цена: Number(position?.цена) || 0,
                        };
                    })
                    .filter((item: OrderPositionSnapshot) => item.товар_id > 0 && item.количество > 0);

            if (activeMissingPositions.length === 0) {
                throw new Error(
                    shouldUseDirectPositions
                        ? 'По этой заявке больше нет необеспеченных позиций для закупки'
                        : 'По этой заявке нет активных недостающих позиций для закупки'
                );
            }

            setCreatePurchaseOrderPositions(activeMissingPositions);
            setSelectedOrder(order);
            setCreatePurchaseModalKey((prev) => prev + 1);
            setIsCreatePurchaseOpen(true);
        } catch (err) {
            console.error('Error preparing purchase from order:', err);
            setError(err instanceof Error ? err.message : 'Ошибка подготовки закупки');
        } finally {
            setOperationLoading(false);
        }
    };

    const openWorkflowModal = async (order: Order) => {
        try {
            setSelectedOrder(order);
            setWorkflowLoading(true);
            setWorkflowError(null);
            setWorkflowSummary(null);
            setIsWorkflowModalOpen(true);

            const response = await fetch(`/api/orders/${order.id}/workflow`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось загрузить сводку по заявке');
            }

            setWorkflowSummary(data as OrderWorkflowModalSummary);
        } catch (err) {
            console.error('Error opening workflow modal:', err);
            setWorkflowError(err instanceof Error ? err.message : 'Не удалось загрузить сводку по заявке');
        } finally {
            setWorkflowLoading(false);
        }
    };

    const handleAssembleOrder = async (order: Order) => {
        try {
            setOperationLoading(true);
            setError(null);

            const response = await fetch(`/api/orders/${order.id}/assemble`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось собрать заявку');
            }

            await fetchOrders();
        } catch (err) {
            console.error('Error assembling order:', err);
            setError(err instanceof Error ? err.message : 'Не удалось собрать заявку');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleCompleteOrder = async (order: Order) => {
        try {
            setOperationLoading(true);
            setError(null);

            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: order.id,
                    клиент_id: order.клиент_id,
                    менеджер_id: order.менеджер_id,
                    адрес_доставки: order.адрес_доставки,
                    статус: 'выполнена',
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error((data as any)?.error || 'Не удалось завершить заявку');
            }

            await fetchOrders();
        } catch (err) {
            console.error('Error completing order:', err);
            setError(err instanceof Error ? err.message : 'Не удалось завершить заявку');
        } finally {
            setOperationLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;
        fetchOrders();
    }, [authLoading, canList, debouncedSearchQuery, filters]);

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canList) {
        return <NoAccessPage />;
    }

    const fetchOrders = async () => {
        try {
            if (orders.length === 0) {
                setLoading(true);
            } else {
                setIsFetching(true);
            }
            const response = await fetch('/api/orders');

            if (!response.ok) {
                throw new Error('Ошибка загрузки заявок');
            }

            let data = await response.json();

            // Apply search
            if (debouncedSearchQuery) {
                const query = debouncedSearchQuery.toLowerCase();
                data = data.filter((order: Order) =>
                    (order.клиент_название?.toLowerCase().includes(query)) ||
                    (order.менеджер_фио?.toLowerCase().includes(query)) ||
                    (order.адрес_доставки?.toLowerCase().includes(query)) ||
                    (order.статус.toLowerCase().includes(query)) ||
                    (order.id.toString().includes(query))
                );
            }

            // Apply status filter
            if (filters.status !== 'all') {
                data = data.filter((order: Order) =>
                    order.статус.toLowerCase() === filters.status.toLowerCase()
                );
            }

            if (filters.executionMode !== 'all') {
                data = data.filter((order: Order) => order.режим_исполнения === filters.executionMode);
            }

            // Apply client filter
            if (filters.clientId !== 'all') {
                data = data.filter((order: Order) => String(order.клиент_id) === String(filters.clientId));
            }

            // Apply client name filter (substring)
            if ((filters.clientName || '').trim()) {
                const clientQuery = (filters.clientName || '').trim().toLowerCase();
                data = data.filter((order: Order) => (order.клиент_название || '').toLowerCase().includes(clientQuery));
            }

            // Apply manager filter (by name substring)
            if (filters.managerName.trim()) {
                const managerQuery = filters.managerName.trim().toLowerCase();
                data = data.filter((order: Order) => (order.менеджер_фио || '').toLowerCase().includes(managerQuery));
            }

            // Apply sorting
            data.sort((a: Order, b: Order) => {
                switch (filters.sortBy) {
                    case 'date-asc':
                        return new Date(a.дата_создания).getTime() - new Date(b.дата_создания).getTime();
                    case 'sum-asc':
                        return a.общая_сумма - b.общая_сумма;
                    case 'sum-desc':
                        return b.общая_сумма - a.общая_сумма;
                    case 'date-desc':
                    default:
                        return new Date(b.дата_создания).getTime() - new Date(a.дата_создания).getTime();
                }
            });

            setOrders(data);

            const ids = (data as Order[]).map((o) => Number(o.id)).filter((n) => Number.isInteger(n) && n > 0);
            if (ids.length > 0) {
                try {
                    const summaryRes = await fetch(`/api/attachments/summary?entity_type=order&entity_ids=${encodeURIComponent(ids.join(','))}`);
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as AttachmentSummaryItem[];
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByOrderId(map);
                    }
                } catch (e) {
                    console.error('Error fetching attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByOrderId({});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const renderAttachmentBadges = (orderId: number) => (
        <OrderAttachmentBadges types={attachmentsTypesByOrderId[orderId] || []} />
    );

    const formatDate = (dateString: string) => formatRuDateTime(dateString);

    const formatCurrency = (amount: number) => formatRuCurrency(amount);

    // CRUD operations
    const handleCreateOrder = async (orderData: any) => {
        try {
            if (!canCreate) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            console.log('Creating order with data:', orderData); // Debug log

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            console.log('Response status:', response.status); // Debug log

            if (!response.ok) {
                let serverMessage = 'Ошибка создания заявки';
                try {
                    const errorData = await response.json();
                    serverMessage = errorData?.error || serverMessage;
                    console.error('Server error:', errorData); // Debug log
                } catch {
                    // ignore
                }
                throw new Error(serverMessage);
            }

            const result = await response.json();
            console.log('Order created successfully:', result); // Debug log

            await fetchOrders(); // Refresh the list
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;

        try {
            if (!canDelete) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            setDeleteBlockedInfo(null);
            const response = await fetch(`/api/orders?id=${selectedOrder.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 409 && errorData?.purchases) {
                    setDeleteBlockedInfo({
                        purchases: Array.isArray(errorData.purchases) ? errorData.purchases : [],
                        movementsCount: Number(errorData.movementsCount) || 0,
                    });
                    setIsDeleteBlockedOpen(true);
                    setIsDeleteConfirmOpen(false);
                    return;
                }

                throw new Error(errorData.error || 'Ошибка удаления заявки');
            }

            await fetchOrders(); // Refresh the list
            setIsDeleteConfirmOpen(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error deleting order:', error);
            setError(error instanceof Error ? error.message : 'Ошибка удаления заявки');
        } finally {
            setOperationLoading(false);
        }
    };

    const openDeleteConfirm = (order: Order) => {
        if (!canDelete) {
            setError('Нет доступа');
            return;
        }
        setSelectedOrder(order);
        setIsDeleteConfirmOpen(true);
    };

    return (
        <div className={styles.container}>
            <OrdersPageHeader
                canCreate={canCreate}
                isRefreshing={loading || isFetching || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                onRefresh={() => {
                    setIsFetching(true);
                    setTableKey((k) => k + 1);
                    setRefreshClickKey((k) => k + 1);
                    setMinRefreshSpinActive(true);
                    void fetchOrders();
                }}
                onCreate={() => setIsCreateModalOpen(true)}
            />

            {loading && orders.length === 0 ? (
                <OrdersPageSkeleton />
            ) : (
                <div className={styles.card}>
                    <OrdersStats orders={orders} formatCurrency={formatCurrency} />

                    <OrdersFilters
                        searchInputValue={searchInputValue}
                        onSearchInputChange={setSearchInputValue}
                        isFiltersOpen={isFiltersOpen}
                        setIsFiltersOpen={setIsFiltersOpen}
                        filters={filters}
                        setFilters={setFilters}
                        syncOrdersUrl={syncOrdersUrl}
                        clientQuery={clientQuery}
                        setClientQuery={setClientQuery}
                        managerQuery={managerQuery}
                        setManagerQuery={setManagerQuery}
                        filteredClientOptions={filteredClientOptions}
                        filteredManagerOptions={filteredManagerOptions}
                        filtersDropdownRef={filtersDropdownRef}
                        filterTriggerRef={filterTriggerRef}
                        sortTriggerRef={sortTriggerRef}
                    />

                    {loading ? (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableContainer} key={tableKey}>
                            <EntityTableSkeleton columns={7} rows={7} actionColumn />
                        </EntityTableSurface>
                    ) : error && !deleteBlockedInfo ? (
                        <div className={styles.errorState}>
                            <p className={styles.errorText}>{error}</p>
                            <Button
                                type="button"
                                className={`${styles.button} ${styles.primaryButton}`}
                                onClick={fetchOrders}
                            >
                                Повторить попытку
                            </Button>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Заявки не найдены</p>
                            {canCreate ? (
                                <CreateEntityButton
                                    className={styles.primaryButton}
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    Создать первую заявку
                                </CreateEntityButton>
                            ) : null}
                        </div>
                    ) : (
                        <EntityTableSurface variant="embedded" clip="bottom" className={styles.tableContainer} key={tableKey}>
                            <OrdersTable
                                orders={orders}
                                hasRowActions={hasRowActions}
                                canView={canView}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                canCreatePurchaseForOrder={canCreatePurchaseForOrder}
                                canAssembleForOrder={canAssembleForOrder}
                                canCreateShipmentForOrder={canCreateShipmentForOrder}
                                canCompleteForOrder={canCompleteForOrder}
                                getAssembleLabel={getAssembleLabel}
                                getShipmentLabel={getShipmentLabel}
                                formatDate={formatDate}
                                formatCurrency={formatCurrency}
                                renderAttachmentBadges={renderAttachmentBadges}
                                onOpenOrder={(order) => router.push(`/orders/${order.id}`)}
                                onEditOrder={openEditModal}
                                onCreatePurchase={openCreatePurchaseForOrder}
                                onAssembleOrder={handleAssembleOrder}
                                onCreateShipment={(order) => {
                                    setSelectedOrder(order);
                                    setIsCreateShipmentOpen(true);
                                }}
                                onCompleteOrder={handleCompleteOrder}
                                onOpenWorkflow={openWorkflowModal}
                                onDeleteOrder={openDeleteConfirm}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}
            {/* Modal Components */}
            <CreateOrderModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateOrder}
                canCreate={canCreate}
            />

            <EditOrderModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedOrder(null);
                }}
                onSubmit={handleEditOrder}
                order={selectedOrder as any}
                canEdit={canEdit}
            />

            <CreatePurchaseModal
                key={`orders-index-purchase-${createPurchaseModalKey}`}
                isOpen={isCreatePurchaseOpen}
                onClose={() => {
                    setIsCreatePurchaseOpen(false);
                    setSelectedOrder(null);
                    setCreatePurchaseOrderPositions([]);
                }}
                onPurchaseCreated={() => {
                    setIsCreatePurchaseOpen(false);
                    setSelectedOrder(null);
                    setCreatePurchaseOrderPositions([]);
                    void fetchOrders();
                }}
                поставщик_id={0}
                поставщик_название=""
                заявка_id={selectedOrder?.id}
                lockOrderId
                initialOrderPositions={createPurchaseOrderPositions}
            />

            <CreateShipmentModal
                isOpen={isCreateShipmentOpen}
                onClose={() => {
                    setIsCreateShipmentOpen(false);
                    setSelectedOrder(null);
                }}
                onCreated={() => {
                    setIsCreateShipmentOpen(false);
                    setSelectedOrder(null);
                    void fetchOrders();
                }}
                initialOrderId={selectedOrder?.id ?? null}
                lockOrderId
            />

            <DeleteConfirmation
                isOpen={isDeleteConfirmOpen}
                onClose={() => {
                    setIsDeleteConfirmOpen(false);
                    setSelectedOrder(null);
                }}
                onConfirm={handleDeleteOrder}
                order={selectedOrder}
                loading={operationLoading}
            />

            <OrderWorkflowModal
                isOpen={isWorkflowModalOpen}
                onClose={() => {
                    setIsWorkflowModalOpen(false);
                    setWorkflowSummary(null);
                    setWorkflowError(null);
                }}
                summary={workflowSummary}
                loading={workflowLoading}
                error={workflowError}
                onOpenOrder={selectedOrder ? () => router.push(`/orders/${selectedOrder.id}`) : undefined}
                onAssemble={selectedOrder && workflowSummary?.canAssemble ? async () => {
                    setIsWorkflowModalOpen(false);
                    await handleAssembleOrder(selectedOrder);
                } : undefined}
                onCreateShipment={selectedOrder && workflowSummary?.canCreateShipment ? () => {
                    setIsWorkflowModalOpen(false);
                    setIsCreateShipmentOpen(true);
                } : undefined}
            />

            <DeleteBlockedDialog
                open={isDeleteBlockedOpen}
                onOpenChange={(open) => {
                    setIsDeleteBlockedOpen(open);
                    if (!open) setDeleteBlockedInfo(null);
                }}
                purchases={deleteBlockedInfo?.purchases || []}
                movementsCount={deleteBlockedInfo?.movementsCount || 0}
                onOpenPurchase={(purchaseId) => router.push(`/purchases/${purchaseId}`)}
                onOpenPurchasesList={() => {
                    if (selectedOrder?.id) {
                        router.push(`/purchases?order_id=${selectedOrder.id}`);
                    } else {
                        router.push('/purchases');
                    }
                    setIsDeleteBlockedOpen(false);
                }}
            />
        </div>
    );
}

export default withLayout(OrdersPage);
