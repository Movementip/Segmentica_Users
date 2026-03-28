import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../../layout/Layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import styles from './Archive.module.css';
import { Badge, Card, Flex, Select, Table, Tabs, Text, TextField } from '@radix-ui/themes';
import { FiSearch } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';

const MotionTableRow = motion(Table.Row);

interface CompletedOrder {
    id: number;
    клиент_id: number;
    менеджер_id: number | null;
    дата_создания: string;
    дата_выполнения: string | null;
    статус: string;
    общая_сумма: number;
    адрес_доставки: string | null;
    клиент_название: string;
    менеджер_фио: string | null;
    количество_позиций: number;
}

interface CompletedPurchase {
    id: number;
    поставщик_id: number;
    заявка_id: number | null;
    дата_заказа: string;
    дата_поступления: string | null;
    статус: string;
    общая_сумма: number;
    поставщик_название: string;
    количество_позиций: number;
}

interface CompletedShipment {
    id: number;
    заявка_id: number;
    транспорт_id: number;
    статус: string;
    номер_отслеживания: string | null;
    дата_отгрузки: string;
    стоимость_доставки: number | null;
    заявка_номер: number;
    клиент_название: string;
    транспорт_название: string;
}

interface EmployeePayment {
    id: number;
    дата?: string;
    сумма?: number;
    сотрудник_id?: number;
    сотрудник_фио?: string;
    сотрудник_должность?: string;
    заявка_id?: number | null;
    заявка_номер?: number | null;
    [key: string]: any;
}

interface FinancialRecord {
    id: number;
    дата?: string;
    сумма?: number;
    тип?: string;
    тип_операции?: string;
    описание?: string;
    комментарий?: string;
    заявка_id?: number | null;
    закупка_id?: number | null;
    отгрузка_id?: number | null;
    заявка_номер?: number | null;
    закупка_номер?: number | null;
    отгрузка_номер?: number | null;
    [key: string]: any;
}

interface ArchiveStatistics {
    завершенные_заявки: number;
    завершенные_закупки: number;
    завершенные_отгрузки: number;
    всего_выплат: number;
    финансовых_записей: number;
    выручка_от_заявок: number | null;
    затраты_на_закупки: number | null;
    общие_выплаты: number | null;
}

interface ArchiveData {
    completedOrders: CompletedOrder[];
    completedPurchases: CompletedPurchase[];
    completedShipments: CompletedShipment[];
    employeePayments: EmployeePayment[];
    financialRecords: FinancialRecord[];
    statistics: ArchiveStatistics;
}

type ArchiveTab = 'orders' | 'purchases' | 'shipments' | 'payments' | 'finance';

type StatusFilter = 'all' | 'done' | 'canceled';
type PeriodFilter = 'all' | '30d' | '7d';

export default function Archive(): JSX.Element {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [data, setData] = useState<ArchiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ArchiveTab>('orders');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

    // Archive permissions are isolated from the source modules.
    const canOrdersTab = Boolean(user?.permissions?.includes('archive.orders.list'));
    const canPurchasesTab = Boolean(user?.permissions?.includes('archive.purchases.list'));
    const canShipmentsTab = Boolean(user?.permissions?.includes('archive.shipments.list'));
    const canPaymentsTab = Boolean(user?.permissions?.includes('archive.payments.list'));
    const canFinanceTab = Boolean(user?.permissions?.includes('archive.finance.list'));

    const canOrdersRow = Boolean(user?.permissions?.includes('archive.orders.view'));
    const canPurchasesRow = Boolean(user?.permissions?.includes('archive.purchases.view'));
    const canShipmentsRow = Boolean(user?.permissions?.includes('archive.shipments.view'));

    const canArchive = canOrdersTab || canPurchasesTab || canShipmentsTab || canPaymentsTab || canFinanceTab;

    useEffect(() => {
        if (authLoading) return;

        const allowedTabs: ArchiveTab[] = [];
        if (canOrdersTab) allowedTabs.push('orders');
        if (canPurchasesTab) allowedTabs.push('purchases');
        if (canShipmentsTab) allowedTabs.push('shipments');
        if (canPaymentsTab) allowedTabs.push('payments');
        if (canFinanceTab) allowedTabs.push('finance');

        if (!allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0] ?? 'orders');
        }
    }, [activeTab, authLoading, canArchive, canFinanceTab, canOrdersTab, canPaymentsTab, canPurchasesTab, canShipmentsTab]);

    const tabsListRef = useRef<HTMLDivElement | null>(null);
    const hasRestoredFromQueryRef = useRef(false);
    const [tabsIndicatorStyle, setTabsIndicatorStyle] = useState<React.CSSProperties>({
        transform: 'translateX(0px)',
        width: 0,
        opacity: 0,
    });
    const [isTabsIndicatorReady, setIsTabsIndicatorReady] = useState(false);

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
        if (!canArchive) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, canArchive]);

    useEffect(() => {
        if (!router.isReady) return;
        if (hasRestoredFromQueryRef.current) return;

        const q = router.query;

        const nextTab = (Array.isArray(q.tab) ? q.tab[0] : q.tab) as ArchiveTab | undefined;
        const nextSearch = Array.isArray(q.search) ? q.search[0] : q.search;
        const nextStatus = (Array.isArray(q.status) ? q.status[0] : q.status) as StatusFilter | undefined;
        const nextPeriod = (Array.isArray(q.period) ? q.period[0] : q.period) as PeriodFilter | undefined;

        if (nextTab === 'orders' || nextTab === 'purchases' || nextTab === 'shipments' || nextTab === 'payments' || nextTab === 'finance') {
            setActiveTab(nextTab);
        }

        if (typeof nextSearch === 'string') {
            setSearch(nextSearch);
            setDebouncedSearch(nextSearch);
        }

        if (nextStatus === 'all' || nextStatus === 'done' || nextStatus === 'canceled') {
            setStatusFilter(nextStatus);
        }

        if (nextPeriod === 'all' || nextPeriod === '30d' || nextPeriod === '7d') {
            setPeriodFilter(nextPeriod);
        }

        hasRestoredFromQueryRef.current = true;
    }, [router.isReady, router.query]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), 250);
        return () => window.clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (!router.isReady) return;
        if (!hasRestoredFromQueryRef.current) return;

        const query: Record<string, string> = {};

        if (activeTab !== 'orders') query.tab = activeTab;
        if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
        if (statusFilter !== 'all') query.status = statusFilter;
        if (periodFilter !== 'all') query.period = periodFilter;

        const currentQuery = router.query;
        const currentTab = Array.isArray(currentQuery.tab) ? currentQuery.tab[0] : currentQuery.tab;
        const currentSearch = Array.isArray(currentQuery.search) ? currentQuery.search[0] : currentQuery.search;
        const currentStatus = Array.isArray(currentQuery.status) ? currentQuery.status[0] : currentQuery.status;
        const currentPeriod = Array.isArray(currentQuery.period) ? currentQuery.period[0] : currentQuery.period;

        const nextTab = query.tab || undefined;
        const nextSearch = query.search || undefined;
        const nextStatus = query.status || undefined;
        const nextPeriod = query.period || undefined;

        const unchanged =
            String(currentTab || '') === String(nextTab || '') &&
            String(currentSearch || '') === String(nextSearch || '') &&
            String(currentStatus || '') === String(nextStatus || '') &&
            String(currentPeriod || '') === String(nextPeriod || '');

        if (unchanged) return;

        router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }, [activeTab, debouncedSearch, periodFilter, router, router.isReady, router.query, statusFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/archive');
            if (!response.ok) throw new Error('Ошибка загрузки архива');
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки архива');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const formatDateTime = (dateString: string) =>
        new Date(dateString).toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    const formatCurrency = (amount: number | null | undefined) => {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
    };

    const isWithinPeriod = useCallback(
        (dateString?: string | null) => {
            if (!dateString) return true;
            if (periodFilter === 'all') return true;

            const d = new Date(dateString);
            if (Number.isNaN(d.getTime())) return true;

            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (periodFilter === '30d') return diffDays <= 30;
            if (periodFilter === '7d') return diffDays <= 7;
            return true;
        },
        [periodFilter]
    );

    const statusBadge = (statusRaw: string) => {
        const s = (statusRaw || '').toLowerCase();
        const isGreen = s === 'выполнена' || s === 'доставлено' || s === 'получено';
        const isRed = s === 'отменена' || s === 'отменено';
        const color = isGreen ? 'green' : isRed ? 'red' : 'gray';
        const pillClass = isGreen ? styles.statusPillGreen : isRed ? styles.statusPillRed : styles.statusPillBlue;

        return (
            <Badge variant="soft" color={color} highContrast className={`${styles.statusPill} ${pillClass}`}>
                {(statusRaw || '-').toUpperCase()}
            </Badge>
        );
    };

    const q = debouncedSearch.trim().toLowerCase();

    const matchesStatus = useCallback(
        (statusRaw: string) => {
            if (statusFilter === 'all') return true;
            const s = (statusRaw || '').toLowerCase();
            const isDone = s === 'выполнена' || s === 'доставлено' || s === 'получено';
            const isCanceled = s === 'отменена' || s === 'отменено';
            if (statusFilter === 'done') return isDone;
            if (statusFilter === 'canceled') return isCanceled;
            return true;
        },
        [statusFilter]
    );

    const filteredOrders = useMemo(() => {
        if (!data) return [];
        return data.completedOrders.filter((o) => {
            if (!matchesStatus(o.статус)) return false;
            if (!isWithinPeriod(o.дата_выполнения || o.дата_создания)) return false;
            if (!q) return true;
            return (
                String(o.id).includes(q) ||
                (o.клиент_название || '').toLowerCase().includes(q) ||
                (o.менеджер_фио || '').toLowerCase().includes(q)
            );
        });
    }, [data, isWithinPeriod, matchesStatus, q]);

    const filteredPurchases = useMemo(() => {
        if (!data) return [];
        return data.completedPurchases.filter((p) => {
            if (!matchesStatus(p.статус)) return false;
            if (!isWithinPeriod(p.дата_поступления || p.дата_заказа)) return false;
            if (!q) return true;
            return String(p.id).includes(q) || (p.поставщик_название || '').toLowerCase().includes(q);
        });
    }, [data, isWithinPeriod, matchesStatus, q]);

    const filteredShipments = useMemo(() => {
        if (!data) return [];
        return data.completedShipments.filter((s) => {
            if (!matchesStatus(s.статус)) return false;
            if (!isWithinPeriod(s.дата_отгрузки)) return false;
            if (!q) return true;
            return (
                String(s.id).includes(q) ||
                String(s.заявка_номер).includes(q) ||
                (s.клиент_название || '').toLowerCase().includes(q) ||
                (s.транспорт_название || '').toLowerCase().includes(q) ||
                (s.номер_отслеживания || '').toLowerCase().includes(q)
            );
        });
    }, [data, isWithinPeriod, matchesStatus, q]);

    const filteredPayments = useMemo(() => {
        if (!data) return [];
        return data.employeePayments.filter((p) => {
            if (!isWithinPeriod(p.дата)) return false;
            if (!q) return true;
            return (
                String(p.id).includes(q) ||
                String(p.заявка_номер || p.заявка_id || '').includes(q) ||
                String(p.сотрудник_фио || '').toLowerCase().includes(q)
            );
        });
    }, [data, isWithinPeriod, q]);

    const paymentsByMonth = useMemo(() => {
        const map = new Map<string, { month: string; count: number; total: number; uniqueEmployees: number }>();
        const employees = new Map<string, Set<string>>();

        filteredPayments.forEach((p) => {
            const d = p.дата ? new Date(p.дата) : null;
            const key = d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '—';

            const item = map.get(key) || { month: key, count: 0, total: 0, uniqueEmployees: 0 };
            item.count += 1;
            item.total += Number(p.сумма) || 0;
            map.set(key, item);

            const set = employees.get(key) || new Set<string>();
            if (p.сотрудник_фио) set.add(String(p.сотрудник_фио));
            employees.set(key, set);
        });

        return Array.from(map.values())
            .map((v) => ({ ...v, uniqueEmployees: employees.get(v.month)?.size || 0 }))
            .sort((a, b) => (a.month < b.month ? 1 : -1));
    }, [filteredPayments]);

    const filteredFinance = useMemo(() => {
        if (!data) return [];
        return data.financialRecords.filter((r) => {
            if (!isWithinPeriod(r.дата)) return false;
            if (!q) return true;
            return (
                String(r.id).includes(q) ||
                String(r.описание || r.комментарий || '').toLowerCase().includes(q) ||
                String(r.заявка_номер || r.закупка_номер || r.отгрузка_номер || '').includes(q)
            );
        });
    }, [data, isWithinPeriod, q]);

    const financeTotals = useMemo(() => {
        let income = 0;
        let expense = 0;

        filteredFinance.forEach((r) => {
            const rawType = String(r.тип_операции || r.тип || '').toLowerCase();
            const amt = Number(r.сумма) || 0;
            const isExpense = rawType.includes('расход') || rawType.includes('спис') || rawType.includes('оплата') || rawType.includes('покуп');
            if (isExpense) expense += amt;
            else income += amt;
        });

        return { income, expense };
    }, [filteredFinance]);

    const stats = data?.statistics;

    if (authLoading) {
        return (
            <Layout>
                <div className={styles.loadingShell}>
                    <Card size="3" variant="surface">
                        <div className={styles.loading}>Загрузка...</div>
                    </Card>
                </div>
            </Layout>
        );
    }

    if (!canArchive) {
        return (
            <Layout>
                <NoAccessPage />
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.title}>Архив</h1>
                            <p className={styles.subtitle}>Завершенные заявки, закупки и отгрузки</p>
                        </div>
                    </div>

                    <Card className={styles.statsContainer}>
                        <div className={styles.statsGridOrdersStyle}>
                            {canOrdersTab ? (
                                <div className={styles.statCardOrdersStyle}>
                                    <div className={styles.statValueOrdersStyle}>{(stats?.завершенные_заявки ?? 0).toLocaleString('ru-RU')}</div>
                                    <div className={styles.statLabelOrdersStyle}>Завершенных заявок</div>
                                </div>
                            ) : null}
                            {canPurchasesTab ? (
                                <div className={styles.statCardOrdersStyle}>
                                    <div className={styles.statValueOrdersStyle}>{(stats?.завершенные_закупки ?? 0).toLocaleString('ru-RU')}</div>
                                    <div className={styles.statLabelOrdersStyle}>Завершенных закупок</div>
                                </div>
                            ) : null}
                            {canShipmentsTab ? (
                                <div className={styles.statCardOrdersStyle}>
                                    <div className={styles.statValueOrdersStyle}>{(stats?.завершенные_отгрузки ?? 0).toLocaleString('ru-RU')}</div>
                                    <div className={styles.statLabelOrdersStyle}>Завершенных отгрузок</div>
                                </div>
                            ) : null}
                            {canOrdersTab ? (
                                <div className={styles.statCardOrdersStyle}>
                                    <div className={styles.statValueOrdersStyle}>{formatCurrency(stats?.выручка_от_заявок ?? 0)}</div>
                                    <div className={styles.statLabelOrdersStyle}>Общая выручка</div>
                                </div>
                            ) : null}
                        </div>
                    </Card>
                </div>

                {loading ? (
                    <div className={styles.loadingShell}>
                        <Card size="3" variant="surface">
                            <div className={styles.loading}>Загрузка...</div>
                        </Card>
                    </div>
                ) : error || !data ? (
                    <Card size="3" variant="surface">
                        <Flex direction="column" gap="3">
                            <Text as="div" size="4" weight="bold">Ошибка</Text>
                            <Text as="div" size="2" color="red">{error || 'Ошибка загрузки данных'}</Text>
                            <Flex>
                                <button type="button" className={styles.retry} onClick={fetchData}>
                                    Повторить
                                </button>
                            </Flex>
                        </Flex>
                    </Card>
                ) : (
                    <div className={styles.tableSection}>
                        <Tabs.Root
                            value={activeTab}
                            onValueChange={(v) => {
                                const next = v as ArchiveTab;
                                const allowed =
                                    (next === 'orders' && canOrdersTab) ||
                                    (next === 'purchases' && canPurchasesTab) ||
                                    (next === 'shipments' && canShipmentsTab) ||
                                    (next === 'payments' && canPaymentsTab) ||
                                    (next === 'finance' && canFinanceTab);

                                if (!allowed) return;
                                setActiveTab(next);
                            }}
                        >
                            <Tabs.List className={styles.tabsList} ref={tabsListRef as any}>
                                <span
                                    className={styles.tabsIndicator}
                                    style={tabsIndicatorStyle}
                                    data-ready={isTabsIndicatorReady ? 'true' : 'false'}
                                    aria-hidden="true"
                                />
                                {canOrdersTab ? <Tabs.Trigger value="orders">Заявки</Tabs.Trigger> : null}
                                {canPurchasesTab ? <Tabs.Trigger value="purchases">Закупки</Tabs.Trigger> : null}
                                {canShipmentsTab ? <Tabs.Trigger value="shipments">Отгрузки</Tabs.Trigger> : null}
                                {canPaymentsTab ? <Tabs.Trigger value="payments">Выплаты</Tabs.Trigger> : null}
                                {canFinanceTab ? <Tabs.Trigger value="finance">Финансы</Tabs.Trigger> : null}
                            </Tabs.List>

                            <div className={styles.tableHeader}>
                                <TextField.Root
                                    className={styles.searchInput}
                                    size="3"
                                    radius="large"
                                    variant="surface"
                                    placeholder={
                                        activeTab === 'payments'
                                            ? 'Поиск по сотруднику или заявке...'
                                            : activeTab === 'finance'
                                                ? 'Поиск по описанию или номеру...'
                                                : 'Поиск по названию или коду...'
                                    }
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                >
                                    <TextField.Slot side="left">
                                        <FiSearch height="16" width="16" />
                                    </TextField.Slot>
                                </TextField.Root>

                                <div className={styles.tableHeaderActions}>
                                    <Select.Root value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                                        <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                        <Select.Content
                                            className={styles.filterSelectContent}
                                            position="popper"
                                            variant="solid"
                                            color="gray"
                                            highContrast
                                        >
                                            <Select.Item value="all">Весь период</Select.Item>
                                            <Select.Item value="30d">Последние 30 дней</Select.Item>
                                            <Select.Item value="7d">Последние 7 дней</Select.Item>
                                        </Select.Content>
                                    </Select.Root>

                                    {activeTab !== 'payments' && activeTab !== 'finance' && (
                                        <Select.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                                            <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                                            <Select.Content
                                                className={styles.filterSelectContent}
                                                position="popper"
                                                variant="solid"
                                                color="gray"
                                                highContrast
                                            >
                                                <Select.Item value="all">Все статусы</Select.Item>
                                                <Select.Item value="done">Завершено</Select.Item>
                                                <Select.Item value="canceled">Отменено</Select.Item>
                                            </Select.Content>
                                        </Select.Root>
                                    )}
                                </div>
                            </div>

                            <div className={styles.contentGrid}>
                                <div className={styles.tableCard}>
                                    <div className={styles.tableContainer}>
                                        {canOrdersTab ? (
                                            <Tabs.Content value="orders">
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>№</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Контрагент</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Менеджер</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Позиций</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата создания</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата выполнения</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredOrders.length ? (
                                                        <AnimatePresence>
                                                            {filteredOrders.map((o) => (
                                                                <MotionTableRow
                                                                    key={o.id}
                                                                    className={styles.tableRow}
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.18 }}
                                                                    onClick={() => {
                                                                        if (!canOrdersRow) return;
                                                                        router.push(`/orders/${o.id}`);
                                                                    }}
                                                                >
                                                                    <Table.Cell>#{o.id}</Table.Cell>
                                                                    <Table.Cell>{o.клиент_название}</Table.Cell>
                                                                    <Table.Cell>{o.менеджер_фио || '-'}</Table.Cell>
                                                                    <Table.Cell>{o.количество_позиций}</Table.Cell>
                                                                    <Table.Cell>{formatCurrency(o.общая_сумма)}</Table.Cell>
                                                                    <Table.Cell>{statusBadge(o.статус)}</Table.Cell>
                                                                    <Table.Cell>{formatDate(o.дата_создания)}</Table.Cell>
                                                                    <Table.Cell>{o.дата_выполнения ? formatDate(o.дата_выполнения) : '-'}</Table.Cell>
                                                                </MotionTableRow>
                                                            ))}
                                                        </AnimatePresence>
                                                    ) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={8}>
                                                                <Text size="2" color="gray">Нет данных</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                            </Tabs.Content>
                                        ) : null}

                                        {canPurchasesTab ? (
                                            <Tabs.Content value="purchases">
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>№</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Поставщик</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Позиций</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата заказа</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата поступления</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredPurchases.length ? (
                                                        <AnimatePresence>
                                                            {filteredPurchases.map((p) => (
                                                                <MotionTableRow
                                                                    key={p.id}
                                                                    className={styles.tableRow}
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.18 }}
                                                                    onClick={() => {
                                                                        if (!canPurchasesRow) return;
                                                                        router.push(`/purchases/${p.id}`);
                                                                    }}
                                                                >
                                                                    <Table.Cell>#{p.id}</Table.Cell>
                                                                    <Table.Cell>{p.поставщик_название}</Table.Cell>
                                                                    <Table.Cell>{p.количество_позиций}</Table.Cell>
                                                                    <Table.Cell>{formatCurrency(p.общая_сумма)}</Table.Cell>
                                                                    <Table.Cell>{statusBadge(p.статус)}</Table.Cell>
                                                                    <Table.Cell>{formatDate(p.дата_заказа)}</Table.Cell>
                                                                    <Table.Cell>{p.дата_поступления ? formatDate(p.дата_поступления) : '-'}</Table.Cell>
                                                                </MotionTableRow>
                                                            ))}
                                                        </AnimatePresence>
                                                    ) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={7}>
                                                                <Text size="2" color="gray">Нет данных</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                            </Tabs.Content>
                                        ) : null}

                                        {canShipmentsTab ? (
                                            <Tabs.Content value="shipments">
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>№</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Трек</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Контрагент</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Транспорт</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Статус</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Дата отгрузки</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Стоимость</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredShipments.length ? (
                                                        <AnimatePresence>
                                                            {filteredShipments.map((s) => (
                                                                <MotionTableRow
                                                                    key={s.id}
                                                                    className={styles.tableRow}
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.18 }}
                                                                    onClick={() => {
                                                                        if (!canShipmentsRow) return;
                                                                        router.push(`/shipments/${s.id}`);
                                                                    }}
                                                                >
                                                                    <Table.Cell>#{s.id}</Table.Cell>
                                                                    <Table.Cell>{s.номер_отслеживания || '-'}</Table.Cell>
                                                                    <Table.Cell>#{s.заявка_номер}</Table.Cell>
                                                                    <Table.Cell>{s.клиент_название}</Table.Cell>
                                                                    <Table.Cell>{s.транспорт_название}</Table.Cell>
                                                                    <Table.Cell>{statusBadge(s.статус)}</Table.Cell>
                                                                    <Table.Cell>{formatDateTime(s.дата_отгрузки)}</Table.Cell>
                                                                    <Table.Cell>{formatCurrency(s.стоимость_доставки)}</Table.Cell>
                                                                </MotionTableRow>
                                                            ))}
                                                        </AnimatePresence>
                                                    ) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={8}>
                                                                <Text size="2" color="gray">Нет данных</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                            </Tabs.Content>
                                        ) : null}

                                        {canPaymentsTab ? (
                                            <Tabs.Content value="payments">
                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Месяц</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Выплат</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сотрудников</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {paymentsByMonth.length ? (
                                                        paymentsByMonth.map((m) => (
                                                            <Table.Row key={m.month} className={styles.tableRow}>
                                                                <Table.Cell>{m.month}</Table.Cell>
                                                                <Table.Cell>{m.count.toLocaleString('ru-RU')}</Table.Cell>
                                                                <Table.Cell>{m.uniqueEmployees.toLocaleString('ru-RU')}</Table.Cell>
                                                                <Table.Cell>{formatCurrency(m.total)}</Table.Cell>
                                                            </Table.Row>
                                                        ))
                                                    ) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={4}>
                                                                <Text size="2" color="gray">Нет данных</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>

                                            <div className={styles.contentGrid}>
                                                <div className={styles.tableCard}>
                                                    <div className={styles.tableContainer}>
                                                        <Table.Root variant="surface" className={styles.table}>
                                                            <Table.Header>
                                                                <Table.Row>
                                                                    <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell>Сотрудник</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell>Заявка</Table.ColumnHeaderCell>
                                                                    <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                                </Table.Row>
                                                            </Table.Header>
                                                            <Table.Body>
                                                                {filteredPayments.length ? (
                                                                    filteredPayments.map((p) => (
                                                                        <Table.Row key={p.id} className={styles.tableRow}>
                                                                            <Table.Cell>{p.дата ? formatDate(p.дата) : '-'}</Table.Cell>
                                                                            <Table.Cell>{p.сотрудник_фио || '-'}</Table.Cell>
                                                                            <Table.Cell>{p.заявка_номер ? `#${p.заявка_номер}` : p.заявка_id ? `#${p.заявка_id}` : '-'}</Table.Cell>
                                                                            <Table.Cell>{formatCurrency(p.сумма)}</Table.Cell>
                                                                        </Table.Row>
                                                                    ))
                                                                ) : (
                                                                    <Table.Row>
                                                                        <Table.Cell colSpan={4}>
                                                                            <Text size="2" color="gray">Нет данных</Text>
                                                                        </Table.Cell>
                                                                    </Table.Row>
                                                                )}
                                                            </Table.Body>
                                                        </Table.Root>
                                                    </div>
                                                </div>
                                            </div>
                                            </Tabs.Content>
                                        ) : null}

                                        {canFinanceTab ? (
                                            <Tabs.Content value="finance">
                                            <Card className={styles.statsContainer}>
                                                <div className={styles.statsGridOrdersStyle}>
                                                    <div className={styles.statCardOrdersStyle}>
                                                        <div className={styles.statValueOrdersStyle}>{formatCurrency(financeTotals.income)}</div>
                                                        <div className={styles.statLabelOrdersStyle}>Приход</div>
                                                    </div>
                                                    <div className={styles.statCardOrdersStyle}>
                                                        <div className={styles.statValueOrdersStyle}>{formatCurrency(financeTotals.expense)}</div>
                                                        <div className={styles.statLabelOrdersStyle}>Расход</div>
                                                    </div>
                                                    <div className={styles.statCardOrdersStyle}>
                                                        <div className={styles.statValueOrdersStyle}>{filteredFinance.length.toLocaleString('ru-RU')}</div>
                                                        <div className={styles.statLabelOrdersStyle}>Записей</div>
                                                    </div>
                                                    <div className={styles.statCardOrdersStyle}>
                                                        <div className={styles.statValueOrdersStyle}>{formatCurrency(financeTotals.income - financeTotals.expense)}</div>
                                                        <div className={styles.statLabelOrdersStyle}>Разница</div>
                                                    </div>
                                                </div>
                                            </Card>

                                            <Table.Root variant="surface" className={styles.table}>
                                                <Table.Header>
                                                    <Table.Row>
                                                        <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Источник</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                                                        <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                    </Table.Row>
                                                </Table.Header>
                                                <Table.Body>
                                                    {filteredFinance.length ? (
                                                        filteredFinance.map((r) => {
                                                            const rawType = String(r.тип_операции || r.тип || '').toLowerCase();
                                                            const isExpense = rawType.includes('расход') || rawType.includes('спис') || rawType.includes('оплата') || rawType.includes('покуп');
                                                            const typeLabel = rawType ? (isExpense ? 'РАСХОД' : 'ПРИХОД') : '—';
                                                            const source = r.заявка_номер
                                                                ? `Заявка #${r.заявка_номер}`
                                                                : r.закупка_номер
                                                                    ? `Закупка #${r.закупка_номер}`
                                                                    : r.отгрузка_номер
                                                                        ? `Отгрузка #${r.отгрузка_номер}`
                                                                        : r.заявка_id
                                                                            ? `Заявка #${r.заявка_id}`
                                                                            : r.закупка_id
                                                                                ? `Закупка #${r.закупка_id}`
                                                                                : r.отгрузка_id
                                                                                    ? `Отгрузка #${r.отгрузка_id}`
                                                                                    : '-';

                                                            return (
                                                                <Table.Row key={r.id} className={styles.tableRow}>
                                                                    <Table.Cell>{r.дата ? formatDate(r.дата) : '-'}</Table.Cell>
                                                                    <Table.Cell>
                                                                        <Badge
                                                                            variant="soft"
                                                                            color={isExpense ? 'red' : 'green'}
                                                                            highContrast
                                                                            className={`${styles.statusPill} ${isExpense ? styles.statusPillRed : styles.statusPillGreen}`}
                                                                        >
                                                                            {typeLabel}
                                                                        </Badge>
                                                                    </Table.Cell>
                                                                    <Table.Cell>{source}</Table.Cell>
                                                                    <Table.Cell>{r.описание || r.комментарий || '-'}</Table.Cell>
                                                                    <Table.Cell>{formatCurrency(r.сумма)}</Table.Cell>
                                                                </Table.Row>
                                                            );
                                                        })
                                                    ) : (
                                                        <Table.Row>
                                                            <Table.Cell colSpan={5}>
                                                                <Text size="2" color="gray">Нет данных</Text>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table.Root>
                                            </Tabs.Content>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </Tabs.Root>
                    </div>
                )}
            </div>
        </Layout>
    );
}
