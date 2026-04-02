import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { CreateClientModal } from '../../components/CreateClientModal';
import EditClientModal from '../../components/EditClientModal';
import ClientOrdersHistoryModal from '../../components/ClientOrdersHistoryModal';
import { ReferenceDataActions } from '../../components/ReferenceDataActions';
import styles from './Clients.module.css';
import deleteConfirmStyles from '../../components/DeleteConfirmation.module.css';
import { Badge, Box, Button, Card, Dialog, DropdownMenu, Flex, Heading, Select, Table, Tabs, Text, TextArea, TextField } from '@radix-ui/themes';
import { FiEdit2, FiEye, FiMoreHorizontal, FiPlus, FiRefreshCw, FiSearch, FiShoppingCart, FiTrash2 } from 'react-icons/fi';
import { FiFilter } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { getClientContragentTypeLabel, getClientContragentTypeTheme, isPersonContragentType, normalizeClientContragentType, type ClientContragent } from '../../lib/clientContragents';

const MotionTableRow = motion(Table.Row);

type Client = ClientContragent;

const formatClientTypes = (raw?: string | null) => {
    return raw ? normalizeClientContragentType(raw) : '-';
};

const getClientTypeList = (raw?: string | null) => {
    return raw ? [normalizeClientContragentType(raw)] : [] as string[];
};

const getTypeBadgeClassName = (raw?: string | null) => {
    const theme = getClientContragentTypeTheme(raw);
    if (theme === 'organization') return styles.typeOrganization;
    if (theme === 'entrepreneur') return styles.typeEntrepreneur;
    if (theme === 'person') return styles.typePerson;
    if (theme === 'advocate') return styles.typeAdvocate;
    if (theme === 'notary') return styles.typeNotary;
    if (theme === 'farm') return styles.typeFarm;
    return styles.typeForeign;
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

    const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);

    const [clientNameQuery, setClientNameQuery] = useState('');

    const [filters, setFilters] = useState({
        type: 'all',
        name: '',
    });

    const syncClientsUrl = (next: { type: string; name: string }) => {
        const query = { ...router.query } as Record<string, any>;

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
        const query = { ...router.query } as Record<string, any>;
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

        if (sort) setSortBy(String(sort) as any);
    }, [router.isReady]);

    const [sortBy, setSortBy] = useState<'id-asc' | 'id-desc' | 'name-asc' | 'name-desc'>('id-desc');

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
            if (isTypeSelectOpen) return;

            const target = e.target as Node | null;
            if (!target) return;

            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const isInsideDropdown = path.length
                ? path.includes(filtersDropdownRef.current as unknown as EventTarget)
                : Boolean(target && filtersDropdownRef.current?.contains(target));
            if (isInsideDropdown) return;

            const isInSelectPortal = path.some((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.hasAttribute('data-clients-filters-select-content')) return true;
                return Boolean(
                    node.closest('[data-clients-filters-select-content]') ||
                    node.closest('.rt-SelectContent') ||
                    node.closest('[data-radix-select-content]')
                );
            });
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
    }, [isFiltersOpen, isTypeSelectOpen]);

    useEffect(() => {
        if (authLoading) return;
        if (!canList) return;

        const timer = setTimeout(() => {
            fetchClients();
        }, searchQuery ? 300 : 0);

        return () => clearTimeout(timer);
    }, [authLoading, canList, searchQuery, filters.type, filters.name, sortBy]);

    const fetchClients = async () => {
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
                        const orders = await ordersRes.json();
                        if (!Array.isArray(orders)) return 0;
                        return orders.reduce((acc: number, o: any) => acc + (Number(o.общая_сумма) || 0), 0);
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
    };

    const renderAttachmentBadges = (clientId: number) => {
        const types = attachmentsTypesByClientId[clientId] || [];
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

    const handleEditClient = async (clientData: any) => {
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

    const handleDeleteClient = (client: Client, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!canDelete) {
            setError('Нет доступа');
            return;
        }
        setSelectedClient(client);
        setIsDeleteModalOpen(true);
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
        return (
            <Box p="5">
                <Text>Загрузка…</Text>
            </Box>
        );
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
            <Box className={styles.header}>
                <Flex className={styles.header_clin} align="center" justify="between" gap="4" wrap="wrap">
                    <Box className={styles.headerLeft}>
                        <Heading size="6" className={styles.title}>Контрагенты</Heading>
                        <Text size="2" color="gray" className={styles.subtitle}>
                            Справочник контрагентов и их реквизитов
                        </Text>
                    </Box>
                    <Flex align="center" gap="2" className={styles.headerActions}>
                        <Button
                            type="button"
                            variant="surface"
                            color="gray"
                            highContrast
                            className={`${styles.surfaceButton} ${styles.headerActionButton}`}
                            onClick={(e) => {
                                e.currentTarget.blur();
                                setIsFetching(true);
                                setRefreshClickKey((k) => k + 1);
                                setMinRefreshSpinActive(true);
                                fetchClients();
                            }}
                            disabled={operationLoading}
                        >
                            <FiRefreshCw
                                key={refreshClickKey}
                                className={isFetching || minRefreshSpinActive ? styles.spin : ''}
                            />
                            Обновить
                        </Button>
                        <ReferenceDataActions
                            catalogKey="clients"
                            permissions={user?.permissions}
                            onImported={fetchClients}
                        />

                        {canCreate ? (
                            <Button
                                type="button"
                                variant="solid"
                                color="gray"
                                highContrast
                                className={`${styles.addClientButton} ${styles.headerActionButtonCreate}`}
                                onClick={handleCreateClient}
                            >
                                <FiPlus className={styles.icon} />
                                Добавить контрагента
                            </Button>
                        ) : null}
                    </Flex>
                </Flex>
            </Box>

            <Card className={styles.statsCard}>
                <Box className={styles.statsContainer}>
                    <Text as="p" className={styles.statsTitle}>Статистика контрагентов</Text>
                    <Box className={styles.statsGrid}>
                        <Box className={styles.statCard}>
                            <Text as="div" className={styles.statValue}>{clients.length}</Text>
                            <Text as="div" className={styles.statLabel}>Всего контрагентов</Text>
                        </Box>
                        <Box className={styles.statCard}>
                            <Text as="div" className={styles.statValue}>{countByType(clients).organizations} / {countByType(clients).persons}</Text>
                            <Text as="div" className={styles.statLabel}>Организаций / частных</Text>
                        </Box>
                        <Box className={styles.statCard}>
                            <Text as="div" className={styles.statValue}>{formatCurrency(turnoverTotal)}</Text>
                            <Text as="div" className={styles.statLabel}>Общий оборот</Text>
                        </Box>
                        <Box className={styles.statCard}>
                            <Text as="div" className={styles.statValue}>{countNewThisMonth(clients)}</Text>
                            <Text as="div" className={styles.statLabel}>Новых в этом месяце</Text>
                        </Box>
                    </Box>
                </Box>
            </Card>

            <Card className={styles.tableCard}>
                <Flex align="center" justify="between" gap="3" className={styles.tableHeaderRow} wrap="wrap">

                    <Flex align="center" gap="2" className={styles.tableActions}>
                        <TextField.Root
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по названию или контакту..."
                            className={styles.searchInput}
                            size="2"
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
                                    data-state={isFiltersOpen ? 'open' : 'closed'}
                                >
                                    <span className={styles.triggerLabel}>
                                        <FiFilter className={styles.icon} />
                                        Фильтры
                                    </span>
                                </Button>

                                {isFiltersOpen ? (
                                    <Box className={styles.filtersDropdownPanel}>
                                        <Tabs.Root defaultValue="type">
                                            <Tabs.List className={styles.filtersTabs}>
                                                <Tabs.Trigger value="type">Тип</Tabs.Trigger>
                                                <Tabs.Trigger value="name">Название</Tabs.Trigger>
                                            </Tabs.List>

                                            <Box pt="3">
                                                <Tabs.Content value="type">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Тип</Text>
                                                        <Select.Root
                                                            value={filters.type}
                                                            onOpenChange={setIsTypeSelectOpen}
                                                            onValueChange={(value) => {
                                                                setFilters((prev) => {
                                                                    const next = { ...prev, type: value };
                                                                    syncClientsUrl(next);
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <Select.Trigger variant="surface" color="gray" className={styles.selectTrigger} />
                                                            <Select.Content
                                                                position="popper"
                                                                variant="solid"
                                                                color="gray"
                                                                highContrast
                                                                data-clients-filters-select-content
                                                            >
                                                                <Select.Item value="all">Все типы</Select.Item>
                                                                <Select.Item value="Организация">Организация</Select.Item>
                                                                <Select.Item value="Индивидуальный предприниматель">Индивидуальный предприниматель</Select.Item>
                                                                <Select.Item value="Физическое лицо">Физическое лицо</Select.Item>
                                                                <Select.Item value="Адвокат">Адвокат</Select.Item>
                                                                <Select.Item value="Нотариус">Нотариус</Select.Item>
                                                                <Select.Item value="Глава КФХ">Глава КФХ</Select.Item>
                                                                <Select.Item value="Иностранный контрагент">Иностранный контрагент</Select.Item>
                                                            </Select.Content>
                                                        </Select.Root>
                                                    </Box>
                                                </Tabs.Content>

                                                <Tabs.Content value="name">
                                                    <Box>
                                                        <Text as="label" size="2" weight="medium">Название</Text>
                                                        <TextArea
                                                            size="2"
                                                            variant="surface"
                                                            resize="none"
                                                            radius="large"
                                                            placeholder="Начни вводить название…"
                                                            value={clientNameQuery}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setClientNameQuery(v);
                                                                setFilters((prev) => {
                                                                    const next = { ...prev, name: v };
                                                                    syncClientsUrl(next);
                                                                    return next;
                                                                });
                                                            }}
                                                            className={styles.filterTextArea}
                                                        />
                                                        {clientNameQuery.trim() ? (
                                                            <div className={styles.inlineSuggestList}>
                                                                {filteredClientNameOptions.length === 0 ? (
                                                                    <div className={styles.inlineSuggestEmpty}>Ничего не найдено</div>
                                                                ) : (
                                                                    filteredClientNameOptions.slice(0, 10).map((name) => (
                                                                        <button
                                                                            key={name}
                                                                            type="button"
                                                                            className={styles.inlineSuggestItem}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                setClientNameQuery(name);
                                                                                setFilters((prev) => {
                                                                                    const next = { ...prev, name };
                                                                                    syncClientsUrl(next);
                                                                                    return next;
                                                                                });
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

                                        <Flex justify="between" gap="3" mt="2" className={styles.filtersDropdownPanelActions}>
                                            <Button
                                                type="button"
                                                variant="surface"
                                                color="gray"
                                                highContrast
                                                onClick={() => {
                                                    setClientNameQuery('');
                                                    setFilters((prev) => {
                                                        const next = { ...prev, type: 'all', name: '' };
                                                        syncClientsUrl(next);
                                                        return next;
                                                    });
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
                                    value={sortBy}
                                    onOpenChange={(open) => {
                                        if (!open) {
                                            sortTriggerRef.current?.blur();
                                            (document.activeElement as HTMLElement | null)?.blur?.();
                                        }
                                    }}
                                    onValueChange={(v) => {
                                        setSortBy(v as any);
                                        syncClientsSortUrl(String(v));
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
                                        <Select.Item value="id-desc">По ID (по убыванию)</Select.Item>
                                        <Select.Item value="id-asc">По ID (по возрастанию)</Select.Item>
                                        <Select.Item value="name-asc">По алфавиту (А–Я)</Select.Item>
                                        <Select.Item value="name-desc">По алфавиту (Я–А)</Select.Item>
                                    </Select.Content>
                                </Select.Root>
                            </div>
                        </div>
                    </Flex>
                </Flex>

                {loading ? (
                    <Box className={styles.loading}>
                        <Text size="2" color="gray">Загрузка контрагентов...</Text>
                    </Box>
                ) : clients.length === 0 ? (
                    <Box className={styles.noResults}>
                        <Text size="2" color="gray">
                            {searchQuery ? 'Контрагенты не найдены' : 'Контрагенты не найдены. Добавьте первого контрагента в базу.'}
                        </Text>
                    </Box>
                ) : (
                    <Box className={styles.tableContainer}>
                        <Table.Root className={styles.table} variant="surface">
                            <colgroup>
                                <col className={styles.colId} />
                                <col className={styles.colName} />
                                <col className={styles.colType} />
                                <col className={styles.colPhone} />
                                <col className={styles.colEmail} />
                                <col className={styles.colAddress} />
                                <col className={styles.colActions} />
                            </colgroup>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Название</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Тип клиента</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Телефон</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Адрес</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell className={styles.actionsHeader}>Действия</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                <AnimatePresence>
                                    {clients.map((client) => {
                                        const hasRowActions = canView || canEdit || canClientOrdersHistory || canDelete;

                                        return (
                                            <MotionTableRow
                                                key={client.id}
                                                className={styles.row}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                onClick={canView ? () => router.push(`/clients/${client.id}`) : undefined}
                                            >
                                                <Table.Cell>
                                                    <div>
                                                        <div>{client.id}</div>
                                                        {renderAttachmentBadges(client.id)}
                                                    </div>
                                                </Table.Cell>
                                                <Table.Cell className={styles.nameCell}>{client.название}</Table.Cell>
                                                <Table.Cell>
                                                    {getClientTypeList(client.тип).length ? (
                                                        <div className={styles.typeBadges}>
                                                            {getClientTypeList(client.тип).map((t) => (
                                                                <span
                                                                    key={t}
                                                                    className={`${styles.typeBadge} ${getTypeBadgeClassName(t)}`}
                                                                >
                                                                    {getClientContragentTypeLabel(t)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span>{formatClientTypes(client.тип)}</span>
                                                    )}
                                                </Table.Cell>
                                                <Table.Cell className={styles.phoneCell}>{client.телефон || '-'}</Table.Cell>
                                                <Table.Cell className={styles.emailCell}>{client.email || '-'}</Table.Cell>
                                                <Table.Cell className={styles.addressCell}>{client.адрес || '-'}</Table.Cell>
                                                <Table.Cell>
                                                    {hasRowActions ? (
                                                        <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger>
                                                                    <button
                                                                        className={styles.menuButton}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        aria-label="Открыть меню"
                                                                    >
                                                                        <FiMoreHorizontal size={18} />
                                                                    </button>
                                                                </DropdownMenu.Trigger>
                                                                <DropdownMenu.Content align="end" sideOffset={6}>
                                                                    {canView ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                e?.stopPropagation?.();
                                                                                router.push(`/clients/${client.id}`);
                                                                            }}
                                                                        >
                                                                            <FiEye className={styles.rowMenuIcon} /> Просмотр
                                                                        </DropdownMenu.Item>
                                                                    ) : null}

                                                                    {canEdit ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                e?.stopPropagation?.();
                                                                                openEditClient(client);
                                                                            }}
                                                                        >
                                                                            <FiEdit2 className={styles.rowMenuIcon} /> Редактировать
                                                                        </DropdownMenu.Item>
                                                                    ) : null}

                                                                    {canClientOrdersHistory ? (
                                                                        <DropdownMenu.Item
                                                                            onSelect={(e) => {
                                                                                e?.preventDefault?.();
                                                                                e?.stopPropagation?.();
                                                                                openClientHistory(client);
                                                                            }}
                                                                        >
                                                                            <FiShoppingCart className={styles.rowMenuIcon} /> История заказов
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
                                                                                    e?.stopPropagation?.();
                                                                                    openDeleteConfirm(client);
                                                                                }}
                                                                            >
                                                                                <FiTrash2 className={styles.rowMenuIconDel} /> Удалить
                                                                            </DropdownMenu.Item>
                                                                        </>
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
                            </Table.Body>
                        </Table.Root>
                    </Box>
                )
                }
            </Card>

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

            <Dialog.Root open={isDeleteModalOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsDeleteModalOpen(false);
                    setSelectedClient(null);
                }
            }}>
                <Dialog.Content className={deleteConfirmStyles.modalContent}>
                    <Dialog.Title>Подтверждение удаления</Dialog.Title>
                    <Box className={deleteConfirmStyles.form}>
                        <Flex direction="column" gap="3">
                            <Text as="div" size="2" color="gray">
                                {selectedClient ? (
                                    <>Вы уверены, что хотите удалить клиента <Text as="span" weight="bold">&quot;{selectedClient.название}&quot;</Text>?</>
                                ) : null}
                            </Text>

                            {selectedClient ? (
                                <Box className={deleteConfirmStyles.positionsSection}>
                                    <Flex direction="column" gap="1">
                                        <Text as="div" weight="bold">Клиент #{selectedClient.id}</Text>
                                        <Text as="div" size="2" color="gray">Название: {selectedClient.название}</Text>
                                    </Flex>
                                </Box>
                            ) : null}

                            <Text as="div" size="2" color="gray">
                                <Text as="span" weight="bold">Внимание:</Text> Это действие нельзя отменить.
                            </Text>

                            <Flex justify="end" gap="3" mt="4" className={deleteConfirmStyles.modalActions}>
                                <Button
                                    type="button"
                                    variant="surface"
                                    color="gray"
                                    highContrast
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setSelectedClient(null);
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
                                    className={deleteConfirmStyles.modalDeleteButton}
                                    onClick={handleConfirmDelete}
                                    disabled={operationLoading}
                                >
                                    {operationLoading ? 'Удаление...' : 'Удалить'}
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                </Dialog.Content>
            </Dialog.Root>
        </div >
    );
}

export default withLayout(ClientsPage);
