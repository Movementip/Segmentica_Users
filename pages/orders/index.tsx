import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import CreateOrderModal from '../../components/CreateOrderModal';
import EditOrderModal from '../../components/EditOrderModal';
import { CreatePurchaseModal, type OrderPositionSnapshot } from '../../components/CreatePurchaseModal';
import { CreateShipmentModal } from '../../components/CreateShipmentModal';
import { OrderWorkflowModal, type OrderWorkflowModalSummary } from '../../components/OrderWorkflowModal';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import styles from './Orders.module.css';
import { FiPlus, FiRefreshCw, FiSearch, FiFilter, FiChevronDown, FiMoreHorizontal, FiEye, FiEdit2, FiShoppingCart, FiTrash2, FiActivity, FiTruck, FiPackage, FiCheckCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Box, Button, Dialog, DropdownMenu, Flex, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { getOrderExecutionModeLabel, type OrderExecutionMode } from '../../lib/orderModes';
import { PageLoader } from '../../components/PageLoader';

const MotionTableRow = motion(Table.Row);

interface Order {
    id: number;
    клиент_id: number;
    менеджер_id?: number;
    режим_исполнения: OrderExecutionMode;
    дата_создания: string;
    дата_выполнения?: string;
    статус: string;
    общая_сумма: number;
    адрес_доставки?: string;
    клиент_название?: string;
    менеджер_фио?: string;
    can_create_purchase?: boolean;
    can_assemble?: boolean;
    can_create_shipment?: boolean;
    can_complete?: boolean;
    next_assembly_label?: string | null;
    next_shipment_label?: string | null;
    недостающие_товары?: Array<{
        статус: string;
        недостающее_количество: number;
    }>;
}

type AttachmentSummaryItem = {
    entity_id: number;
    types: string[];
};

interface LinkedPurchase {
    id: number;
    статус?: string;
    дата_заказа?: string;
    общая_сумма?: number;
}

type ClientOption = { id: number; name: string };

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

    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

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
            if (isStatusSelectOpen) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean((e.target as Node | null) && filtersDropdownRef.current?.contains(e.target as Node));

            if (isInsideDropdown) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-orders-filters-select-content')) return true;
                return Boolean(
                    node.closest('[data-orders-filters-select-content]') ||
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

    const renderAttachmentBadges = (orderId: number) => {
        const types = attachmentsTypesByOrderId[orderId] || [];
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
            case 'новая':
                return '#1976d2';
            case 'в обработке':
                return '#f57c00';
            case 'подтверждена':
                return '#7b1fa2';
            case 'в работе':
                return '#0288d1';
            case 'досборка':
                return '#8d6e63';
            case 'собрана':
                return '#5d4037';
            case 'доотгрузка':
                return '#00796b';
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
            {/* Header Section */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Заявки</h1>
                        <p className={styles.subtitle}>Управление заявками клиентов</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={(e) => {
                                e.currentTarget.blur();
                                setIsFetching(true);
                                setTableKey((k) => k + 1);
                                setRefreshClickKey((k) => k + 1);
                                setMinRefreshSpinActive(true);
                                fetchOrders();
                            }}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                className={loading || isFetching || minRefreshSpinActive ? styles.spin : ''}
                            />
                            Обновить
                        </Button>

                        {canCreate ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.primaryButton} ${styles.headerActionButtonDel}`}
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                <FiPlus className={styles.icon} />
                                Новая заявка
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className={styles.card}>
                {/* Stats Cards */}
                <div className={styles.statsContainer}>
                    <h2 className={styles.statsTitle}>Статистика заявок</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.new}`}>
                                {orders.filter(o => o.статус.toLowerCase() === 'новая').length}
                            </div>
                            <div className={styles.statLabel}>Новые</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.inProgress}`}>
                                {orders.filter(o => o.статус.toLowerCase() === 'в обработке').length}
                            </div>
                            <div className={styles.statLabel}>В обработке</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.completed}`}>
                                {orders.filter(o => o.статус.toLowerCase() === 'выполнена').length}
                            </div>
                            <div className={styles.statLabel}>Выполнены</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.total}`}>
                                {formatCurrency(orders.reduce((sum, o) => sum + o.общая_сумма, 0))}
                            </div>
                            <div className={styles.statLabel}>Общая сумма</div>
                        </div>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className={styles.searchSection}>
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
                            >
                                <span className={styles.triggerLabel}>
                                    <FiFilter className={styles.icon} />
                                    Фильтры
                                </span>
                            </Button>

                            {isFiltersOpen ? (
                                <Box className={styles.filtersDropdownPanel} data-orders-filters-dropdown>
                                    <Tabs.Root defaultValue="status">
                                        <Tabs.List className={styles.filtersTabs}>
                                            <Tabs.Trigger value="status">Статус</Tabs.Trigger>
                                            <Tabs.Trigger value="mode">Режим</Tabs.Trigger>
                                            <Tabs.Trigger value="client">Контрагент</Tabs.Trigger>
                                            <Tabs.Trigger value="manager">Менеджер</Tabs.Trigger>
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
                                                                syncOrdersUrl({ clientId: next.clientId, status: next.status, executionMode: next.executionMode, managerName: next.managerName, sortBy: next.sortBy });
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast data-orders-filters-select-content>
                                                            <Select.Item value="all">Все статусы</Select.Item>
                                                            <Select.Item value="новая">Новая</Select.Item>
                                                            <Select.Item value="в обработке">В обработке</Select.Item>
                                                            <Select.Item value="подтверждена">Подтверждена</Select.Item>
                                                            <Select.Item value="в работе">В работе</Select.Item>
                                                            <Select.Item value="собрана">Собрана</Select.Item>
                                                            <Select.Item value="выполнена">Выполнена</Select.Item>
                                                            <Select.Item value="отгружена">Отгружена</Select.Item>
                                                            <Select.Item value="отменена">Отменена</Select.Item>
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="mode">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Режим заявки</Text>
                                                    <Select.Root
                                                        value={filters.executionMode}
                                                        onValueChange={(value) => {
                                                            setFilters((prev) => {
                                                                const next = { ...prev, executionMode: value };
                                                                syncOrdersUrl({ clientId: next.clientId, status: next.status, executionMode: next.executionMode, managerName: next.managerName, sortBy: next.sortBy });
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                        <Select.Content position="popper" variant="solid" color="gray" highContrast data-orders-filters-select-content>
                                                            <Select.Item value="all">Все режимы</Select.Item>
                                                            <Select.Item value="warehouse">{getOrderExecutionModeLabel('warehouse')}</Select.Item>
                                                            <Select.Item value="direct">{getOrderExecutionModeLabel('direct')}</Select.Item>
                                                        </Select.Content>
                                                    </Select.Root>
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="client">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Контрагент</Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="Начни вводить имя контрагента…"
                                                        value={clientQuery}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setClientQuery(v);
                                                            setFilters((prev) => ({
                                                                ...prev,
                                                                clientName: v,
                                                                clientId: v.trim() ? prev.clientId : 'all',
                                                            }));
                                                            if (!v.trim()) {
                                                                syncOrdersUrl({ clientId: 'all', status: filters.status, executionMode: filters.executionMode, managerName: filters.managerName, sortBy: filters.sortBy });
                                                            }
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />
                                                    {clientQuery.trim() ? (
                                                        <div className={styles.inlineSuggestList}>
                                                            {filteredClientOptions.length === 0 ? (
                                                                <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                            ) : (
                                                                filteredClientOptions.slice(0, 10).map((c) => (
                                                                    <button
                                                                        key={c.id}
                                                                        type="button"
                                                                        className={styles.inlineSuggestItem}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            setClientQuery(c.name);
                                                                            setFilters((prev) => ({ ...prev, clientId: String(c.id), clientName: c.name }));
                                                                            syncOrdersUrl({ clientId: String(c.id), status: filters.status, executionMode: filters.executionMode, managerName: filters.managerName, sortBy: filters.sortBy });
                                                                        }}
                                                                    >
                                                                        {c.name}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </Box>
                                            </Tabs.Content>

                                            <Tabs.Content value="manager">
                                                <Box>
                                                    <Text as="label" size="2" weight="medium">Менеджер</Text>
                                                    <TextArea
                                                        size="2"
                                                        variant="surface"
                                                        resize="none"
                                                        radius="large"
                                                        placeholder="Начни вводить ФИО менеджера…"
                                                        value={managerQuery}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setManagerQuery(v);
                                                            setFilters((prev) => {
                                                                const next = { ...prev, managerName: v };
                                                                syncOrdersUrl({ clientId: next.clientId, status: next.status, executionMode: next.executionMode, managerName: next.managerName, sortBy: next.sortBy });
                                                                return next;
                                                            });
                                                        }}
                                                        className={styles.filterTextArea}
                                                    />
                                                    {managerQuery.trim() ? (
                                                        <div className={styles.inlineSuggestList}>
                                                            {filteredManagerOptions.length === 0 ? (
                                                                <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                            ) : (
                                                                filteredManagerOptions.slice(0, 10).map((name) => (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        className={styles.inlineSuggestItem}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            setFilters((prev) => {
                                                                                const next = { ...prev, managerName: name };
                                                                                syncOrdersUrl({ clientId: next.clientId, status: next.status, executionMode: next.executionMode, managerName: next.managerName, sortBy: next.sortBy });
                                                                                return next;
                                                                            });
                                                                            setManagerQuery(name);
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
                                        </Box>
                                    </Tabs.Root>

                                    <Flex justify="between" gap="3" className={styles.filtersDropdownPanelActions}>
                                        <Button
                                            type="button"
                                            variant="surface"
                                            color="gray"
                                            highContrast
                                            onClick={() => {
                                                setClientQuery('');
                                                setManagerQuery('');
                                                setFilters({ status: 'all', executionMode: 'all', sortBy: filters.sortBy, clientId: 'all', managerName: '', clientName: '' });
                                                syncOrdersUrl({ clientId: 'all', status: 'all', executionMode: 'all', managerName: '', sortBy: filters.sortBy });
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
                                    setFilters({ ...filters, sortBy: value });
                                    syncOrdersUrl({ clientId: filters.clientId, status: filters.status, executionMode: filters.executionMode, managerName: filters.managerName, sortBy: value });
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
                    <div className={styles.tableContainer} key={tableKey}>
                        <PageLoader label="Загрузка заявок..." />
                    </div>
                ) : error && !deleteBlockedInfo ? (
                    <div className={styles.errorState}>
                        <p className={styles.errorText}>{error}</p>
                        <button
                            className={`${styles.button} ${styles.primaryButton}`}
                            onClick={fetchOrders}
                        >
                            Повторить попытку
                        </button>
                    </div>
                ) : orders.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>Заявки не найдены</p>
                        {canCreate ? (
                            <button
                                className={`${styles.button} ${styles.primaryButton}`}
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                <FiPlus className={styles.icon} />
                                Создать первую заявку
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className={styles.tableContainer} key={tableKey}>
                        <Table.Root variant="surface" className={styles.table}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Контрагент</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Менеджер</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={`${styles.textRight} ${styles.sumColumn}`}>
                                        <div className={styles.sumColumnInner}>Сумма</div>
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Адрес</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                <AnimatePresence>
                                    {orders.map((order) => (
                                        <MotionTableRow
                                            key={order.id}
                                            className={styles.tableRow}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            onClick={canView ? () => router.push(`/orders/${order.id}`) : undefined}
                                        >
                                            <Table.Cell className={styles.tableCell}>
                                                <div>
                                                    <span className={styles.orderId}>#{order.id}</span>
                                                    {order.режим_исполнения === 'direct' ? (
                                                        <Badge color="gray" variant="soft" highContrast>
                                                            {getOrderExecutionModeLabel(order.режим_исполнения)}
                                                        </Badge>
                                                    ) : null}
                                                    {renderAttachmentBadges(order.id)}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div className={styles.clientCell}>
                                                    <div className={styles.clientName}>
                                                        {order.клиент_название || `Клиент ID: ${order.клиент_id}`}
                                                    </div>
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div className={styles.managerCell}>
                                                    {order.менеджер_фио || (order.менеджер_id ? `ID: ${order.менеджер_id}` : 'Не назначен')}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div className={styles.dateCell}>
                                                    {formatDate(order.дата_создания)}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div
                                                    className={styles.statusBadge}
                                                    style={{
                                                        backgroundColor: `${getStatusColor(order.статус)}15`,
                                                        color: getStatusColor(order.статус),
                                                        border: `1px solid ${getStatusColor(order.статус)}40`
                                                    }}
                                                >
                                                    {order.статус}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={`${styles.tableCell} ${styles.textRight} ${styles.amountCell} ${styles.sumColumn}`}>
                                                <div className={styles.sumColumnInner}>{formatCurrency(order.общая_сумма)}</div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                <div className={styles.addressCell}>
                                                    {order.адрес_доставки || 'Не указан'}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className={styles.tableCell}>
                                                {hasRowActions ? (
                                                    <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu.Root>
                                                            <DropdownMenu.Trigger>
                                                                <button
                                                                    type="button"
                                                                    className={`menuButton`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    aria-label="Меню"
                                                                    title="Действия"
                                                                >
                                                                    <FiMoreHorizontal size={18} />
                                                                </button>
                                                            </DropdownMenu.Trigger>
                                                            <DropdownMenu.Content align="end" sideOffset={6}>
                                                                {canView ? (
                                                                    <DropdownMenu.Item onSelect={(e) => {
                                                                        e?.preventDefault?.();
                                                                        router.push(`/orders/${order.id}`);
                                                                    }}>
                                                                        <FiEye className={styles.rowMenuIcon} />
                                                                        Просмотр
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canEdit ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            void openEditModal(order);
                                                                        }}
                                                                    >
                                                                        <FiEdit2 className={styles.rowMenuIcon} />
                                                                        Редактировать
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canCreatePurchaseForOrder(order) ? (
                                                                <DropdownMenu.Item
                                                                    onSelect={(e) => {
                                                                        e?.preventDefault?.();
                                                                        void openCreatePurchaseForOrder(order);
                                                                        }}
                                                                    >
                                                                        <FiShoppingCart className={styles.rowMenuIcon} />
                                                                        Создать закупку
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canAssembleForOrder(order) ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            void handleAssembleOrder(order);
                                                                        }}
                                                                    >
                                                                        <FiPackage className={styles.rowMenuIcon} />
                                                                        {getAssembleLabel(order)}
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canCreateShipmentForOrder(order) ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            setSelectedOrder(order);
                                                                            setIsCreateShipmentOpen(true);
                                                                        }}
                                                                    >
                                                                        <FiTruck className={styles.rowMenuIcon} />
                                                                        {getShipmentLabel(order)}
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canCompleteForOrder(order) ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            void handleCompleteOrder(order);
                                                                        }}
                                                                    >
                                                                        <FiCheckCircle className={styles.rowMenuIcon} />
                                                                        Завершить заявку
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canView ? (
                                                                    <DropdownMenu.Item
                                                                        onSelect={(e) => {
                                                                            e?.preventDefault?.();
                                                                            void openWorkflowModal(order);
                                                                        }}
                                                                    >
                                                                        <FiActivity className={styles.rowMenuIcon} />
                                                                        Статус заявки
                                                                    </DropdownMenu.Item>
                                                                ) : null}

                                                                {canDelete ? (
                                                                    <>
                                                                        <DropdownMenu.Separator />
                                                                        <DropdownMenu.Item
                                                                            color="red"
                                                                            className={styles.rowMenuItemDanger}
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                openDeleteConfirm(order);
                                                                            }}
                                                                        >
                                                                            <FiTrash2 className={styles.rowMenuIconDel} />
                                                                            Удалить
                                                                        </DropdownMenu.Item>
                                                                    </>
                                                                ) : null}
                                                            </DropdownMenu.Content>
                                                        </DropdownMenu.Root>
                                                    </div>
                                                ) : null}
                                            </Table.Cell>
                                        </MotionTableRow>
                                    ))}
                                </AnimatePresence>
                            </Table.Body>
                        </Table.Root>
                    </div>
                )}
            </div>
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

            <Dialog.Root open={isDeleteBlockedOpen} onOpenChange={(open) => setIsDeleteBlockedOpen(open)}>
                <Dialog.Content className={styles.modalContent}>
                    <Dialog.Title>Невозможно удалить заявку</Dialog.Title>

                    <Box className={styles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                У заявки есть связанные закупки ({deleteBlockedInfo?.purchases?.length || 0}){deleteBlockedInfo?.movementsCount ? ` и движения склада (${deleteBlockedInfo.movementsCount})` : ''}. Сначала удалите/обработайте их.
                            </Text>

                            {deleteBlockedInfo?.purchases?.length ? (
                                <Box className={styles.positionsSection}>
                                    <Flex direction="column" gap="2">
                                        <Text as="div" weight="bold">Связанные закупки</Text>
                                        <Flex gap="2" wrap="wrap">
                                            {deleteBlockedInfo.purchases.map((p) => (
                                                <Button
                                                    key={p.id}
                                                    type="button"
                                                    variant="outline"
                                                    color="gray"
                                                    highContrast
                                                    className={styles.purchaseChipButton}
                                                    onClick={() => router.push(`/purchases/${p.id}`)}
                                                >
                                                    Закупка #{p.id}
                                                </Button>
                                            ))}
                                        </Flex>
                                    </Flex>
                                </Box>
                            ) : null}

                            <Flex justify="end" gap="3" mt="4" className={styles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    className={styles.surfaceButton}
                                    onClick={() => {
                                        setIsDeleteBlockedOpen(false);
                                        setDeleteBlockedInfo(null);
                                    }}
                                >
                                    Закрыть
                                </Button>
                                <Button
                                    type="button"
                                    variant="solid"
                                    color="gray"
                                    highContrast
                                    onClick={() => {
                                        if (selectedOrder?.id) {
                                            router.push(`/purchases?order_id=${selectedOrder.id}`);
                                        } else {
                                            router.push('/purchases');
                                        }
                                        setIsDeleteBlockedOpen(false);
                                    }}
                                >
                                    Перейти к закупкам
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}

export default withLayout(OrdersPage);
