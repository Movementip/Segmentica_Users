import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { CreateClientModal } from '../../components/modals/CreateClientModal/CreateClientModal';
import EditClientModal from '../../components/modals/EditClientModal/EditClientModal';
import ClientOrdersHistoryModal from '../../components/modals/ClientOrdersHistoryModal/ClientOrdersHistoryModal';
import styles from './Clients.module.css';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/ui/NoAccessPage/NoAccessPage';
import { PageLoader } from '../../components/ui/PageLoader/PageLoader';
import DeleteConfirmation from '../../components/modals/DeleteConfirmation/DeleteConfirmation';
import { CreateEntityButton } from '../../components/CreateEntityButton/CreateEntityButton';
import { ClientsFilters } from '../../components/clients/ClientsFilters/ClientsFilters';
import { ClientsPageHeader } from '../../components/clients/ClientsPageHeader/ClientsPageHeader';
import { ClientsTable } from '../../components/clients/ClientsTable/ClientsTable';
import { EntityTableSkeleton, EntityTableSurface } from '../../components/EntityDataTable/EntityDataTable';
import { EntityIndexPageSkeleton } from '../../components/EntityIndexPageSkeleton/EntityIndexPageSkeleton';
import { EntityStatsPanel } from '../../components/EntityStatsPanel/EntityStatsPanel';
import { isPersonContragentType, normalizeClientContragentType, type ClientContragent } from '../../lib/clientContragents';

type Client = ClientContragent;
type ClientSortBy = 'id-asc' | 'id-desc' | 'name-asc' | 'name-desc';
type QueryState = Record<string, string | string[] | undefined>;
type ClientOrderSummary = {
    общая_сумма?: number | string | null;
};

const getClientTypeList = (raw?: string | null) => {
    return raw ? [normalizeClientContragentType(raw)] : [] as string[];
};

const isClientSortBy = (value: string): value is ClientSortBy => {
    return value === 'id-asc' || value === 'id-desc' || value === 'name-asc' || value === 'name-desc';
};

function ClientsPage(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [minRefreshSpinActive, setMinRefreshSpinActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [operationLoading, setOperationLoading] = useState(false);

    const [attachmentsTypesByClientId, setAttachmentsTypesByClientId] = useState<Record<number, string[]>>({});

    const [refreshClickKey, setRefreshClickKey] = useState(0);

    const canList = Boolean(user?.permissions?.includes('clients.list'));
    const canView = Boolean(user?.permissions?.includes('clients.view'));
    const canCreate = Boolean(user?.permissions?.includes('clients.create'));
    const canEdit = Boolean(user?.permissions?.includes('clients.edit'));
    const canDelete = Boolean(user?.permissions?.includes('clients.delete'));
    const canOrdersList = Boolean(user?.permissions?.includes('orders.list'));
    const canClientOrdersHistory = Boolean(user?.permissions?.includes('clients.orders_history.view'));

    useEffect(() => {
        if (!minRefreshSpinActive) return;
        const t = window.setTimeout(() => setMinRefreshSpinActive(false), 525);
        return () => window.clearTimeout(t);
    }, [minRefreshSpinActive]);

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const sortTriggerRef = useRef<HTMLButtonElement>(null);

    const [clientNameQuery, setClientNameQuery] = useState('');

    const [filters, setFilters] = useState({
        type: 'all',
        name: '',
    });

    const syncClientsUrl = (next: { type: string; name: string }) => {
        const query: QueryState = { ...router.query };

        if (next.type && next.type !== 'all') query.type = String(next.type);
        else delete query.type;

        if ((next.name || '').trim()) query.name = String(next.name).trim();
        else delete query.name;

        router.replace(
            {
                pathname: router.pathname,
                query,
            },
            undefined,
            { shallow: true }
        );
    };

    const syncClientsSortUrl = (sort: string) => {
        const query: QueryState = { ...router.query };
        if (sort && sort !== 'id-desc') query.sort = String(sort);
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
        const typeRaw = router.query.type;
        const nameRaw = router.query.name;
        const sortRaw = router.query.sort;

        const type = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;
        const name = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
        const sort = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;

        setFilters((prev) => ({
            ...prev,
            type: type ? String(type) : prev.type,
            name: name ? String(name) : prev.name,
        }));

        if (name) setClientNameQuery(String(name));

        const normalizedSort = sort ? String(sort) : '';
        if (isClientSortBy(normalizedSort)) setSortBy(normalizedSort);
    }, [router.isReady, router.query.name, router.query.sort, router.query.type]);

    const [sortBy, setSortBy] = useState<ClientSortBy>('id-desc');

    const [turnoverTotal, setTurnoverTotal] = useState<number>(0);

    const clientNameOptions = useMemo(() => {
        const set = new Set<string>();
        for (const c of clients) {
            const name = (c.название || '').trim();
            if (name) set.add(name);
        }
        const res = Array.from(set.values());
        res.sort((a, b) => a.localeCompare(b, 'ru'));
        return res;
    }, [clients]);

    const filteredClientNameOptions = useMemo(() => {
        const q = clientNameQuery.trim().toLowerCase();
        if (!q) return clientNameOptions;
        return clientNameOptions.filter((n) => n.toLowerCase().includes(q));
    }, [clientNameOptions, clientNameQuery]);

    useEffect(() => {
        if (!isFiltersOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null;
            if (!target) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean(target && filtersDropdownRef.current?.contains(target));
            if (isInsideDropdown) return;

            const targetElement = e.target instanceof Element ? e.target : null;
            const isInSelectPortal = Boolean(
                targetElement?.closest('[data-slot="select-content"], [data-slot="select-item"]')
            );
            if (isInSelectPortal) return;

            setIsFiltersOpen(false);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFiltersOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isFiltersOpen]);

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            if (!canList) {
                setClients([]);
                return;
            }
            const response = await fetch('/api/clients');

            if (!response.ok) {
                throw new Error('Ошибка загрузки клиентов');
            }

            let data = await response.json();

            // Apply search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                data = data.filter((client: Client) =>
                    (client.название?.toLowerCase().includes(query)) ||
                    (client.телефон?.toLowerCase().includes(query)) ||
                    (client.email?.toLowerCase().includes(query)) ||
                    (client.адрес?.toLowerCase().includes(query)) ||
                    (client.id.toString().includes(query))
                );
            }

            // Apply filters
            if (filters.type !== 'all') {
                data = data.filter((client: Client) => {
                    const list = getClientTypeList(client.тип);
                    return list.some((t) => t === filters.type);
                });
            }

            if (filters.name.trim()) {
                const q = filters.name.trim().toLowerCase();
                data = data.filter((client: Client) => (client.название || '').toLowerCase().includes(q));
            }

            // Apply sort
            data = [...data].sort((a: Client, b: Client) => {
                if (sortBy === 'id-asc') return a.id - b.id;
                if (sortBy === 'id-desc') return b.id - a.id;

                const an = (a.название || '').toLocaleLowerCase('ru-RU');
                const bn = (b.название || '').toLocaleLowerCase('ru-RU');
                const cmp = an.localeCompare(bn, 'ru-RU');
                return sortBy === 'name-asc' ? cmp : -cmp;
            });

            setClients(data);

            const clientIds = (data as Client[])
                .map((c) => Number(c.id))
                .filter((n) => Number.isInteger(n) && n > 0);

            if (clientIds.length > 0 && canView) {
                try {
                    const summaryRes = await fetch(
                        `/api/attachments/summary?entity_type=client&entity_ids=${encodeURIComponent(clientIds.join(','))}`
                    );
                    if (summaryRes.ok) {
                        const summaryData = (await summaryRes.json()) as Array<{ entity_id: number; types: string[] }>;
                        const map: Record<number, string[]> = {};
                        for (const item of Array.isArray(summaryData) ? summaryData : []) {
                            const key = Number(item.entity_id);
                            if (!Number.isInteger(key)) continue;
                            map[key] = Array.isArray(item.types) ? item.types : [];
                        }
                        setAttachmentsTypesByClientId(map);
                    }
                } catch (e) {
                    console.error('Error fetching client attachments summary:', e);
                }
            } else {
                setAttachmentsTypesByClientId({});
            }

            // Compute turnover total (sum of all client orders)
            // This is intentionally done client-by-client using existing API.
            if (canOrdersList) {
                const totals = await Promise.all(
                    (data as Client[]).map(async (client) => {
                        const ordersRes = await fetch(`/api/orders?client_id=${client.id}`);
                        if (!ordersRes.ok) return 0;
                        const orders = await ordersRes.json() as ClientOrderSummary[];
                        if (!Array.isArray(orders)) return 0;
                        return orders.reduce((acc: number, order) => acc + (Number(order.общая_сумма) || 0), 0);
                    })
                );
                setTurnoverTotal(totals.reduce((a, b) => a + b, 0));
            } else {
                setTurnoverTotal(0);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    }, [canList, canOrdersList, canView, filters.name, filters.type, searchQuery, sortBy]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;

        const timer = setTimeout(() => {
            void fetchClients();
        }, searchQuery ? 300 : 0);

        return () => clearTimeout(timer);
    }, [authLoading, canList, fetchClients, searchQuery]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const countNewThisMonth = (items: Client[]) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return items.filter((c) => {
            if (!c.created_at) return false;
            const d = new Date(c.created_at);
            return d >= start && d < end;
        }).length;
    };

    const countByType = (items: Client[]) => {
        const organizations = items.filter((c) => normalizeClientContragentType(c.тип) === 'Организация').length;
        const persons = items.filter((c) => isPersonContragentType(c.тип)).length;
        return { organizations, persons };
    };

    const clientTypeStats = countByType(clients);
    const newThisMonthCount = countNewThisMonth(clients);

    const handleCreateClient = () => {
        if (!canCreate) {
            setError('Нет доступа');
            return;
        }
        setIsCreateModalOpen(true);
    };

    const openEditClient = async (client: Client) => {
        if (!canEdit) {
            setError('Нет доступа');
            return;
        }
        try {
            setOperationLoading(true);
            const response = await fetch(`/api/clients?id=${client.id}`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить карточку контрагента');
            }
            const fullClient = await response.json();
            setSelectedClient(fullClient);
            setIsEditModalOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки карточки контрагента');
        } finally {
            setOperationLoading(false);
        }
    };

    const openClientHistory = (client: Client) => {
        if (!canClientOrdersHistory) {
            setError('Нет доступа');
            return;
        }
        setSelectedClient(client);
        setIsHistoryModalOpen(true);
    };

    const handleEditClient = async (clientData: unknown) => {
        try {
            if (!canEdit) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch('/api/clients', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clientData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления клиента');
            }

            await fetchClients();
            setIsEditModalOpen(false);
            setSelectedClient(null);
        } catch (err) {
            console.error('Error updating client:', err);
            setError(err instanceof Error ? err.message : 'Ошибка обновления клиента');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedClient) return;

        try {
            if (!canDelete) {
                setError('Нет доступа');
                return;
            }
            setOperationLoading(true);
            const response = await fetch(`/api/clients?id=${selectedClient.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления клиента');
            }

            await fetchClients();
            setIsDeleteModalOpen(false);
            setSelectedClient(null);
        } catch (error) {
            console.error('Error deleting client:', error);
            setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleClientCreated = () => {
        fetchClients();
        setIsCreateModalOpen(false);
    };

    const openDeleteConfirm = (client: Client) => {
        if (!canDelete) {
            setError('Нет доступа');
            return;
        }
        setSelectedClient(client);
        setIsDeleteModalOpen(true);
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
                <div className={styles.error}>
                    Ошибка: {error}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <ClientsPageHeader
                canCreate={canCreate}
                permissions={user?.permissions}
                isRefreshing={loading || isFetching || minRefreshSpinActive}
                refreshKey={refreshClickKey}
                operationLoading={operationLoading}
                onRefresh={() => {
                    setIsFetching(true);
                    setRefreshClickKey((key) => key + 1);
                    setMinRefreshSpinActive(true);
                    fetchClients();
                }}
                onCreate={handleCreateClient}
                onImported={fetchClients}
            />

            {loading && clients.length === 0 ? (
                <EntityIndexPageSkeleton
                    ariaLabel="Загрузка контрагентов"
                    title="Статистика контрагентов"
                    columns={6}
                    rows={6}
                    actionColumn
                />
            ) : (
                <div className={styles.card}>
                    <EntityStatsPanel
                        title="Статистика контрагентов"
                        items={[
                            {
                                label: 'Всего контрагентов',
                                value: clients.length,
                            },
                            {
                                label: 'Организаций / частных',
                                value: `${clientTypeStats.organizations} / ${clientTypeStats.persons}`,
                            },
                            {
                                label: 'Общий оборот',
                                value: formatCurrency(turnoverTotal),
                            },
                            {
                                label: 'Новых в этом месяце',
                                value: newThisMonthCount,
                            },
                        ]}
                    />

                    <ClientsFilters
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        isFiltersOpen={isFiltersOpen}
                        setIsFiltersOpen={setIsFiltersOpen}
                        filters={filters}
                        setFilters={setFilters}
                        syncClientsUrl={syncClientsUrl}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        syncClientsSortUrl={syncClientsSortUrl}
                        clientNameQuery={clientNameQuery}
                        setClientNameQuery={setClientNameQuery}
                        filteredClientNameOptions={filteredClientNameOptions}
                        filtersDropdownRef={filtersDropdownRef}
                        filterTriggerRef={filterTriggerRef}
                        sortTriggerRef={sortTriggerRef}
                    />

                    {loading ? (
                        <EntityTableSurface className={styles.tableContainer} variant="embedded" clip="bottom">
                            <EntityTableSkeleton columns={6} rows={6} />
                        </EntityTableSurface>
                    ) : clients.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>Контрагенты не найдены</p>
                            {canCreate ? (
                                <CreateEntityButton onClick={handleCreateClient}>
                                    Создать первого контрагента
                                </CreateEntityButton>
                            ) : null}
                        </div>
                    ) : (
                        <EntityTableSurface className={styles.tableContainer} variant="embedded" clip="bottom">
                            <ClientsTable
                                clients={clients}
                                canView={canView}
                                canEdit={canEdit}
                                canHistory={canClientOrdersHistory}
                                canDelete={canDelete}
                                attachmentTypesByClientId={attachmentsTypesByClientId}
                                onOpenClient={(client) => router.push(`/clients/${client.id}`)}
                                onEditClient={openEditClient}
                                onOpenHistory={openClientHistory}
                                onDeleteClient={openDeleteConfirm}
                            />
                        </EntityTableSurface>
                    )}
                </div>
            )}

            <CreateClientModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onClientCreated={handleClientCreated}
            />

            <EditClientModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedClient(null);
                }}
                onSubmit={handleEditClient}
                client={selectedClient}
            />

            <ClientOrdersHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => {
                    setIsHistoryModalOpen(false);
                    setSelectedClient(null);
                }}
                clientId={selectedClient?.id ?? null}
                clientName={selectedClient?.название}
            />

            <DeleteConfirmation
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedClient(null);
                }}
                onConfirm={handleConfirmDelete}
                loading={operationLoading}
                title="Удаление контрагента"
                message={selectedClient ? `Удалить контрагента "${selectedClient.название}"?` : 'Удалить контрагента?'}
                warning="Это действие нельзя отменить."
                confirmText="Удалить"
                details={selectedClient ? (
                    <div>
                        <div>Клиент #{selectedClient.id}</div>
                        <div>Название: {selectedClient.название}</div>
                    </div>
                ) : null}
            />
        </div >
    );
}

export default withLayout(ClientsPage);
