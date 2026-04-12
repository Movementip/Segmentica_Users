import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { PageLoader } from '../../components/PageLoader';
import {
    FiCalendar,
    FiDollarSign,
    FiBox,
    FiTruck,
    FiPackage,
    FiUsers,
    FiDownload
} from 'react-icons/fi';
import Link from 'next/link';
import styles from './Reports.module.css';
import { Button, Card, Flex, Grid, Heading, Progress, Select, Table, Tabs, Text } from '@radix-ui/themes';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { REPORT_TAB_PERMISSIONS, REPORT_VIEW_PERMISSIONS } from '../../lib/reportsRbac';

type Period = 'all' | '6m' | '3m' | '1m';
type AnalyticsTab = 'overview' | 'sales' | 'products' | 'clients' | 'logistics' | 'custom';

const ACCOUNT_LABELS: Record<string, string> = {
    '10.мат': '10.мат Материалы и сырье',
    '10.дет': '10.дет Детали, комплектующие и полуфабрикаты',
    '10.см': '10.см Топливо',
    '10.зап': '10.зап Запасные части',
    '10.стр': '10.стр Строительные материалы',
    '10.хоз': '10.хоз Хозяйственные принадлежности и инвентарь',
    '10.спец': '10.спец Специальная одежда',
    '10.тара': '10.тара Тара',
    '10.пр': '10.пр Прочие материалы',
    '20': '20 Основное производство',
    '23': '23 Вспомогательные производства',
    '25': '25 Общепроизводственные расходы',
    '26': '26 Общехозяйственные (управленческие) расходы',
    '29': '29 Обслуживающие производства и хозяйства',
    '44': '44 Расходы на продажу (коммерческие расходы)',
    '91.02': '91.02 Прочие расходы',
    '97': '97 Расходы будущих периодов',
};

interface DashboardStats {
    activeOrders: number;
    totalProducts: number;
    activeSuppliers: number;
    lowStockItems: number;
    recentOrders: Array<{ id: number; client: string; amount: number; status: string; created_at: string }>;
    stockByCategory: Array<{ category: string; count: number }>;
    warehouseMovements: Array<{ id: number; product_name: string; quantity: number; operation_type: string; operation_date: string }>;
    salesByPeriod: Array<{ период: string; количество_продаж: number; общая_сумма: number; средний_чек: number }>;
}

type ViewRow = Record<string, any>;

type OverviewData = {
    byMonth: Array<{ month: string; revenue: number; expense: number; profit: number; orders: number }>;
    byCategory: Array<{ name: string; value: number; percent: number }>;
};

type AccountAnalyticsRow = {
    account: string;
    amount: number;
    share: number;
    quantity?: number;
    items?: number;
    positions?: number;
    products?: number;
};

type AccountingMovementRow = {
    account: string;
    openingAmount: number;
    incomingAmount: number;
    outgoingAmount: number;
    closingAmount: number;
    openingQuantity: number;
    incomingQuantity: number;
    outgoingQuantity: number;
    closingQuantity: number;
};

type ExpenseMonthRow = {
    month: string;
    total: number;
    accounts: Array<{
        account: string;
        amount: number;
        share: number;
    }>;
};

type ExpenseDetailRow = {
    account: string;
    productId: number | null;
    productName: string;
    nomenclatureType: string | null;
    amount: number;
    records: number;
    share: number;
    shareWithinAccount: number;
};

type AccountsData = {
    inventoryByAccount: AccountAnalyticsRow[];
    accountingMovement: AccountingMovementRow[];
    expenseByAccount: AccountAnalyticsRow[];
    expenseStructure: {
        topAccounts: string[];
        byMonth: ExpenseMonthRow[];
    };
    expenseDetails: ExpenseDetailRow[];
    totals: {
        inventoryAmount: number;
        expenseAmount: number;
    };
};

type TopProductRow = {
    product_id: number;
    product_name: string;
    sold_units: number;
    revenue: number;
    margin_percent: number;
    trend_percent: number;
};

type TopClientRow = {
    client_id: number;
    client_name: string;
    orders_count: number;
    revenue: number;
    avg_check: number;
    growth_percent: number;
};

type TransportPerformanceRow = {
    transport_id: number;
    transport_name: string;
    shipments: number;
    on_time: number;
    rating_percent: number;
    avg_cost: number;
};

const titleForView = (viewName: string): string => {
    const map: Record<string, string> = {
        анализ_клиентов: 'Топ клиенты',
        продажи_по_периодам: 'Продажи по периодам',
        анализ_недостач: 'Недостачи',
        движения_склада_детализированные: 'Движения склада',
        статистика_транспортных_компаний: 'Эффективность транспортных компаний',
        анализ_поставщиков: 'Анализ поставщиков'
    };
    return map[viewName] || viewName;
};

const formatCell = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') {
        const trimmed = value.trim();

        // ISO date/time or date-only -> dd.mm.yyyy
        if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const d = new Date(trimmed);
            if (!Number.isNaN(d.getTime())) {
                return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        }

        // Numeric strings (e.g. 80316.1666666667) -> compact number
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            const n = Number(trimmed);
            if (Number.isFinite(n)) {
                const hasFraction = Math.abs(n % 1) > 1e-9;
                return new Intl.NumberFormat('ru-RU', {
                    maximumFractionDigits: hasFraction ? 2 : 0,
                }).format(n);
            }
        }
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return String(value);
        const hasFraction = Math.abs(value % 1) > 1e-9;
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: hasFraction ? 2 : 0,
        }).format(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const findDateColumnKey = (columns: string[]): string | null => {
    if (!columns.length) return null;
    return columns.find((k) => /дата|date/i.test(k)) || columns.find((k) => /_at$/i.test(k)) || null;
};

const getAccountLabel = (account: string): string => ACCOUNT_LABELS[account] || account;

const ReportsPage = () => {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [period, setPeriod] = useState<Period>('6m');
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
    const tabsListRef = useRef<HTMLDivElement | null>(null);
    const [tabsIndicatorStyle, setTabsIndicatorStyle] = useState<React.CSSProperties>({
        transform: 'translateX(0px)',
        width: 0,
        opacity: 0,
    });
    const [isTabsIndicatorReady, setIsTabsIndicatorReady] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const [viewsCache, setViewsCache] = useState<Record<string, { rows: ViewRow[]; columns: string[] }>>({});
    const [viewsLoading, setViewsLoading] = useState<Record<string, boolean>>({});

    const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    const [accountsData, setAccountsData] = useState<AccountsData | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(false);

    const [topProducts, setTopProducts] = useState<TopProductRow[] | null>(null);
    const [topProductsLoading, setTopProductsLoading] = useState(false);

    const [topClients, setTopClients] = useState<TopClientRow[] | null>(null);
    const [topClientsLoading, setTopClientsLoading] = useState(false);

    const [transportPerf, setTransportPerf] = useState<TransportPerformanceRow[] | null>(null);
    const [transportPerfLoading, setTransportPerfLoading] = useState(false);

    const canOverviewTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.overview));
    const canSalesTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.sales));
    const canProductsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.products));
    const canClientsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.clients));
    const canLogisticsTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.logistics));
    const canCustomTab = Boolean(user?.permissions?.includes(REPORT_TAB_PERMISSIONS.custom));
    const canReports = canOverviewTab || canSalesTab || canProductsTab || canClientsTab || canLogisticsTab || canCustomTab;

    useEffect(() => {
        if (authLoading) return;

        const allowedTabs: AnalyticsTab[] = [];
        if (canOverviewTab) allowedTabs.push('overview');
        if (canSalesTab) allowedTabs.push('sales');
        if (canProductsTab) allowedTabs.push('products');
        if (canClientsTab) allowedTabs.push('clients');
        if (canLogisticsTab) allowedTabs.push('logistics');
        if (canCustomTab) allowedTabs.push('custom');

        if (!allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0] ?? 'overview');
        }
    }, [activeTab, authLoading, canClientsTab, canCustomTab, canLogisticsTab, canOverviewTab, canProductsTab, canSalesTab]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/dashboard');
                if (!res.ok) throw new Error('Failed to load stats');
                const data = (await res.json()) as DashboardStats;
                setStats(data);
            } catch {
                setStats(null);
            } finally {
                setLoading(false);
            }
        };
        if (!canReports) {
            setStats(null);
            setLoading(false);
            return;
        }
        fetchStats();
    }, [canReports]);

    useEffect(() => {
        if (!router.isReady) return;

        const q = router.query;
        const nextTabRaw = Array.isArray(q.tab) ? q.tab[0] : q.tab;
        const nextTab = nextTabRaw as AnalyticsTab | undefined;

        if (nextTab === 'overview' || nextTab === 'sales' || nextTab === 'products' || nextTab === 'clients' || nextTab === 'logistics' || nextTab === 'custom') {
            setActiveTab(nextTab);
        }
        // restore only from URL
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        if (!router.isReady) return;

        const query: Record<string, string> = {};
        if (activeTab !== 'overview') query.tab = activeTab;

        const currentQuery = router.query;
        const currentTab = Array.isArray(currentQuery.tab) ? currentQuery.tab[0] : currentQuery.tab;
        const nextTab = query.tab || undefined;

        const unchanged = String(currentTab || '') === String(nextTab || '');
        if (unchanged) return;

        router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }, [activeTab, router, router.isReady, router.query]);

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
        if (activeTab !== 'overview' && activeTab !== 'sales') return;
        if ((activeTab === 'overview' && !canOverviewTab) || (activeTab === 'sales' && !canSalesTab)) return;
        const run = async () => {
            try {
                setOverviewLoading(true);
                const res = await fetch(`/api/reports/overview?period=${encodeURIComponent(period)}`);
                if (!res.ok) throw new Error('Failed');
                const json = (await res.json()) as OverviewData;
                setOverviewData(json);
            } catch {
                setOverviewData(null);
            } finally {
                setOverviewLoading(false);
            }
        };
        void run();
    }, [activeTab, canOverviewTab, canSalesTab, period]);

    useEffect(() => {
        if (activeTab !== 'overview' || !canOverviewTab) return;
        const run = async () => {
            try {
                setAccountsLoading(true);
                const res = await fetch(`/api/reports/accounts?period=${encodeURIComponent(period)}`);
                if (!res.ok) throw new Error('Failed');
                const json = (await res.json()) as AccountsData;
                setAccountsData(json);
            } catch {
                setAccountsData(null);
            } finally {
                setAccountsLoading(false);
            }
        };
        void run();
    }, [activeTab, canOverviewTab, period]);

    useEffect(() => {
        if (activeTab !== 'logistics' || !canLogisticsTab) return;
        const run = async () => {
            try {
                setTransportPerfLoading(true);
                const res = await fetch(`/api/reports/transport-performance?period=${encodeURIComponent(period)}`);
                if (!res.ok) throw new Error('Failed');
                const json = await res.json();
                const rows: TransportPerformanceRow[] = Array.isArray(json?.data) ? json.data : [];
                setTransportPerf(rows);
            } catch {
                setTransportPerf(null);
            } finally {
                setTransportPerfLoading(false);
            }
        };
        void run();
    }, [activeTab, canLogisticsTab, period]);

    useEffect(() => {
        if (activeTab !== 'clients' || !canClientsTab) return;
        const run = async () => {
            try {
                setTopClientsLoading(true);
                const res = await fetch(`/api/reports/top-clients?period=${encodeURIComponent(period)}`);
                if (!res.ok) throw new Error('Failed');
                const json = await res.json();
                const rows: TopClientRow[] = Array.isArray(json?.data) ? json.data : [];
                setTopClients(rows);
            } catch {
                setTopClients(null);
            } finally {
                setTopClientsLoading(false);
            }
        };
        void run();
    }, [activeTab, canClientsTab, period]);

    useEffect(() => {
        if (activeTab !== 'products' || !canProductsTab) return;
        const run = async () => {
            try {
                setTopProductsLoading(true);
                const res = await fetch(`/api/reports/top-products?period=${encodeURIComponent(period)}`);
                if (!res.ok) throw new Error('Failed');
                const json = await res.json();
                const rows: TopProductRow[] = Array.isArray(json?.data) ? json.data : [];
                setTopProducts(rows);
            } catch {
                setTopProducts(null);
            } finally {
                setTopProductsLoading(false);
            }
        };
        void run();
    }, [activeTab, canProductsTab, period]);

    const ensureViewLoaded = async (viewName: string) => {
        if (!user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])) return;
        if (viewsCache[viewName]) return;
        if (viewsLoading[viewName]) return;

        setViewsLoading((s) => ({ ...s, [viewName]: true }));
        try {
            const res = await fetch(`/api/reports/${encodeURIComponent(viewName)}`);
            if (!res.ok) throw new Error('Failed');
            const json = await res.json();
            const rows: ViewRow[] = Array.isArray(json?.data) ? json.data : [];
            const columns = rows.length ? Object.keys(rows[0]) : [];
            setViewsCache((s) => ({ ...s, [viewName]: { rows, columns } }));
        } catch {
            setViewsCache((s) => ({ ...s, [viewName]: { rows: [], columns: [] } }));
        } finally {
            setViewsLoading((s) => ({ ...s, [viewName]: false }));
        }
    };

    const viewsByTab: Record<Exclude<AnalyticsTab, 'custom'>, string[]> = {
        overview: ['продажи_по_периодам', 'анализ_недостач'],
        sales: ['продажи_по_периодам'],
        products: ['движения_склада_детализированные', 'анализ_недостач', 'анализ_поставщиков'],
        clients: ['анализ_клиентов'],
        logistics: ['статистика_транспортных_компаний']
    };

    useEffect(() => {
        if (activeTab === 'custom') return;
        const needed = (viewsByTab[activeTab] || []).filter((viewName) => user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName]));
        needed.forEach((v) => void ensureViewLoaded(v));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.permissions]);

    const reports = [
        {
            id: 1,
            title: 'Анализ контрагентов',
            description: 'Статистика по контрагентам, категории, средний чек и активность',
            icon: <FiUsers size={24} />,
            viewName: 'анализ_клиентов',
            color: '#3B82F6'
        },
        {
            id: 2,
            title: 'Анализ недостач',
            description: 'Отчет по недостающим товарам и их влиянию на продажи',
            icon: <FiPackage size={24} />,
            viewName: 'анализ_недостач',
            color: '#EF4444'
        },
        {
            id: 3,
            title: 'Анализ поставщиков',
            description: 'Рейтинг и эффективность работы поставщиков',
            icon: <FiTruck size={24} />,
            viewName: 'анализ_поставщиков',
            color: '#10B981'
        },
        {
            id: 4,
            title: 'Движения склада',
            description: 'Подробная информация о движении товаров на складе',
            icon: <FiBox size={24} />,
            viewName: 'движения_склада_детализированные',
            color: '#8B5CF6'
        },
        {
            id: 5,
            title: 'Продажи по периодам',
            description: 'Анализ продаж в разрезе временных периодов',
            icon: <FiCalendar size={24} />,
            viewName: 'продажи_по_периодам',
            color: '#F59E0B'
        },
        {
            id: 6,
            title: 'Статистика ТК',
            description: 'Анализ работы транспортных компаний',
            icon: <FiTruck size={24} />,
            viewName: 'статистика_транспортных_компаний',
            color: '#EC4899'
        },
        {
            id: 7,
            title: 'Финансовый обзор',
            description: 'Основные финансовые показатели и метрики',
            icon: <FiDollarSign size={24} />,
            viewName: 'финансовый_обзор',
            color: '#10B981'
        }
    ].filter((report) => user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[report.viewName]));

    const periodMonths = period === 'all' ? Infinity : period === '6m' ? 6 : period === '3m' ? 3 : 1;

    const salesRows = useMemo(() => {
        const rows = stats?.salesByPeriod || [];
        if (period === 'all') return rows;
        return rows.slice(0, periodMonths);
    }, [period, periodMonths, stats?.salesByPeriod]);

    const metrics = useMemo(() => {
        const revenue = salesRows.reduce((acc, r) => acc + Number(r.общая_сумма || 0), 0);
        const orders = salesRows.reduce((acc, r) => acc + Number(r.количество_продаж || 0), 0);
        const avgCheck = orders > 0 ? revenue / orders : 0;
        const shipped = (stats?.warehouseMovements || []).filter((m) => String(m.operation_type).toLowerCase() === 'расход').length;
        return { revenue, orders, shipped, avgCheck };
    }, [salesRows, stats?.warehouseMovements]);

    const expenseStructureChartData = useMemo(() => {
        const rows = accountsData?.expenseStructure?.byMonth || [];
        return rows.map((row) => {
            const values = row.accounts.reduce<Record<string, number>>((acc, entry) => {
                acc[entry.account] = Number(entry.amount) || 0;
                return acc;
            }, {});

            return {
                month: row.month,
                total: Number(row.total) || 0,
                ...values,
            };
        });
    }, [accountsData]);

    const expenseStructureKeys = accountsData?.expenseStructure?.topAccounts || [];

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);

    const chartColors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899'];

    const CartesianGridAny = CartesianGrid as any;
    const ResponsiveContainerAny = ResponsiveContainer as any;

    const isWithinPeriod = (raw: any) => {
        if (period === 'all') return true;
        if (!raw) return true;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return true;
        const now = new Date();
        const months = periodMonths;
        const start = new Date(now);
        start.setMonth(start.getMonth() - months);
        return d >= start;
    };

    const renderViewBlock = (viewName: string) => {
        if (!user?.permissions?.includes(REPORT_VIEW_PERMISSIONS[viewName])) return null;
        const cached = viewsCache[viewName];
        const isLoading = !!viewsLoading[viewName];
        const rows = cached?.rows || [];
        const columns = cached?.columns || [];
        const dateKey = findDateColumnKey(columns);

        const filteredRows = dateKey ? rows.filter((r) => isWithinPeriod(r[dateKey])) : rows;
        const visibleRows = filteredRows.slice(0, 20);
        const visibleCols = columns.slice(0, 8);

        return (
            <Card key={viewName} className={styles.blockCard}>
                <Flex justify="between" align="center" className={styles.blockHeader}>
                    <Text size="3" weight="bold" className={styles.blockTitle}>
                        {titleForView(viewName)}
                    </Text>
                    <Link href={`/reports/view?name=${encodeURIComponent(viewName)}`} className={styles.blockLink}>
                        <Button variant="surface" color="gray" radius="large" size="2" className={styles.surfaceButton}>
                            Просмотреть
                        </Button>
                    </Link>
                </Flex>

                <div className={styles.tableWrapper}>
                    <Table.Root variant="surface" className={styles.table}>
                        <Table.Header>
                            <Table.Row>
                                {visibleCols.map((c) => (
                                    <Table.ColumnHeaderCell key={c}>{c}</Table.ColumnHeaderCell>
                                ))}
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {isLoading ? (
                                <Table.Row>
                                    <Table.Cell colSpan={Math.max(1, visibleCols.length)}>
                                        <PageLoader label="Загрузка отчета..." />
                                    </Table.Cell>
                                </Table.Row>
                            ) : visibleRows.length ? (
                                visibleRows.map((r, idx) => (
                                    <Table.Row key={idx} className={styles.tableRow}>
                                        {visibleCols.map((c) => (
                                            <Table.Cell key={c} title={formatCell(r?.[c])}>
                                                <div className={styles.cellContent}>{formatCell(r?.[c])}</div>
                                            </Table.Cell>
                                        ))}
                                    </Table.Row>
                                ))
                            ) : (
                                <Table.Row>
                                    <Table.Cell colSpan={Math.max(1, visibleCols.length)}>
                                        <Text size="2" color="gray">Нет данных</Text>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table.Root>
                </div>
            </Card>
        );
    };

    if (authLoading || loading) {
        return <PageLoader label="Загрузка..." fullPage />;
    }

    if (!canReports) {
        return <NoAccessPage />;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Отчеты и аналитика</h1>
                    <p className={styles.subtitle}>Комплексный анализ бизнес-процессов и ключевых показателей</p>
                </div>

                <Flex className={styles.headerActions} gap="2" wrap="wrap" align="center">
                    <Select.Root value={period} onValueChange={(v) => setPeriod(v as Period)}>
                        <Select.Trigger variant="surface" color="gray" className={styles.filterSelectTrigger} />
                        <Select.Content className={styles.filterSelectContent} position="popper" variant="solid" color="gray" highContrast>
                            <Select.Item value="all">Весь период</Select.Item>
                            <Select.Item value="6m">Последние 6 месяцев</Select.Item>
                            <Select.Item value="3m">Последние 3 месяца</Select.Item>
                            <Select.Item value="1m">Последний месяц</Select.Item>
                        </Select.Content>
                    </Select.Root>


                </Flex>
            </div>

            <div className={styles.surface}>
                <div
                    className={styles.statsContainer}
                    style={{ display: loading ? 'none' : undefined }}
                >
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.total}`}>{formatCurrency(metrics.revenue)}</div>
                            <div className={styles.statLabel}>Выручка</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.inProgress}`}>{metrics.orders.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabel}>Заявки</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.completed}`}>{metrics.shipped.toLocaleString('ru-RU')}</div>
                            <div className={styles.statLabel}>Отгружено</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={`${styles.statValue} ${styles.total}`}>{formatCurrency(metrics.avgCheck)}</div>
                            <div className={styles.statLabel}>Средний чек</div>
                        </div>
                    </div>
                </div>

                <Tabs.Root
                    value={activeTab}
                    onValueChange={(v) => {
                        const next = v as AnalyticsTab;
                        const allowed =
                            (next === 'overview' && canOverviewTab) ||
                            (next === 'sales' && canSalesTab) ||
                            (next === 'products' && canProductsTab) ||
                            (next === 'clients' && canClientsTab) ||
                            (next === 'logistics' && canLogisticsTab) ||
                            (next === 'custom' && canCustomTab);

                        if (!allowed) return;
                        setActiveTab(next);
                    }}
                    className={styles.analyticsTabs}
                >
                    <Tabs.List className={styles.tabsList} ref={tabsListRef as any}>
                        <span
                            className={styles.tabsIndicator}
                            style={tabsIndicatorStyle}
                            data-ready={isTabsIndicatorReady ? 'true' : 'false'}
                            aria-hidden="true"
                        />
                        {canOverviewTab ? <Tabs.Trigger value="overview">Общий обзор</Tabs.Trigger> : null}
                        {canSalesTab ? <Tabs.Trigger value="sales">Продажи</Tabs.Trigger> : null}
                        {canProductsTab ? <Tabs.Trigger value="products">Товары</Tabs.Trigger> : null}
                        {canClientsTab ? <Tabs.Trigger value="clients">Клиенты</Tabs.Trigger> : null}
                        {canLogisticsTab ? <Tabs.Trigger value="logistics">Логистика</Tabs.Trigger> : null}
                        {canCustomTab ? <Tabs.Trigger value="custom">Пользовательские отчеты</Tabs.Trigger> : null}
                    </Tabs.List>

                    <div className={styles.blocksWrap}>
                        {canOverviewTab ? <Tabs.Content value="overview">
                            <Grid className={styles.blocksGrid} columns={{ initial: '1', md: '2' }} gap="4">
                                <Card className={styles.chartCard}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">Динамика выручки и прибыли</Text>
                                    </Flex>
                                    <div className={styles.chartBox}>
                                        {overviewLoading || !overviewData ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : (
                                            <ResponsiveContainerAny width="100%" height={260}>
                                                <LineChart data={overviewData.byMonth} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                                                    <CartesianGridAny strokeDasharray="3 3" stroke="#eeeeee" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip
                                                        formatter={(v: any) => formatCurrency(Number(v) || 0)}
                                                        labelFormatter={(l: any) => String(l)}
                                                    />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#10b981" strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainerAny>
                                        )}
                                    </div>
                                </Card>

                                <Card className={styles.chartCard}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">По категориям</Text>
                                    </Flex>
                                    <div className={styles.chartBox}>
                                        {overviewLoading || !overviewData ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : (
                                            <ResponsiveContainerAny width="100%" height={260}>
                                                <PieChart>
                                                    <Tooltip formatter={(v: any) => String(v)} />
                                                    <Pie
                                                        data={overviewData.byCategory}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={90}
                                                        label={(p: any) => `${p.name} ${p.payload.percent}%`}
                                                    >
                                                        {overviewData.byCategory.map((_, idx) => (
                                                            <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainerAny>
                                        )}
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">Динамика заказов</Text>
                                    </Flex>
                                    <div className={styles.chartBox}>
                                        {overviewLoading || !overviewData ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : (
                                            <ResponsiveContainerAny width="100%" height={240}>
                                                <BarChart data={overviewData.byMonth} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                                                    <CartesianGridAny strokeDasharray="3 3" stroke="#eeeeee" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip formatter={(v: any) => String(v)} />
                                                    <Legend />
                                                    <Bar dataKey="orders" name="Заявки" fill="#10b981" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainerAny>
                                        )}
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex justify="between" align="center" className={styles.blockHeader}>
                                        <Flex direction="column" gap="1">
                                            <Text size="3" weight="bold" className={styles.blockTitle}>
                                                Остатки по счетам учета
                                            </Text>
                                            {!accountsLoading && accountsData ? (
                                                <Text size="2" color="gray">
                                                    Всего в остатках: {formatCurrency(Number(accountsData.totals.inventoryAmount) || 0)}
                                                </Text>
                                            ) : null}
                                        </Flex>
                                    </Flex>

                                    <div className={styles.tableWrapper}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Счет</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Кол-во</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Товаров</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Доля</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {accountsLoading ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <PageLoader label="Загрузка отчета..." />
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : accountsData?.inventoryByAccount?.length ? (
                                                    accountsData.inventoryByAccount.map((row) => (
                                                        <Table.Row key={`inventory-${row.account}`} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{getAccountLabel(row.account)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.amount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.quantity) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.items) || 0)}</Table.Cell>
                                                            <Table.Cell>{`${Number(row.share || 0).toFixed(1)}%`}</Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                ) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <Text size="2" color="gray">Нет данных</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex justify="between" align="center" className={styles.blockHeader}>
                                        <Flex direction="column" gap="1">
                                            <Text size="3" weight="bold" className={styles.blockTitle}>
                                                Движение по счетам учета
                                            </Text>
                                            <Text size="2" color="gray">
                                                Остаток на начало, закупки, выбытие и остаток на конец периода
                                            </Text>
                                        </Flex>
                                    </Flex>

                                    <div className={styles.tableWrapper}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Счет</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Начало</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Закупки</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Выбытие</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Конец</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Кол-во начало</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Кол-во приход</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Кол-во расход</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Кол-во конец</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {accountsLoading ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={9}>
                                                            <PageLoader label="Загрузка отчета..." />
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : accountsData?.accountingMovement?.length ? (
                                                    accountsData.accountingMovement.map((row) => (
                                                        <Table.Row key={`movement-${row.account}`} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{getAccountLabel(row.account)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.openingAmount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.incomingAmount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.outgoingAmount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.closingAmount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.openingQuantity) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.incomingQuantity) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.outgoingQuantity) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.closingQuantity) || 0)}</Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                ) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={9}>
                                                            <Text size="2" color="gray">Нет данных</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex justify="between" align="center" className={styles.blockHeader}>
                                        <Flex direction="column" gap="1">
                                            <Text size="3" weight="bold" className={styles.blockTitle}>
                                                Расходы по счетам затрат
                                            </Text>
                                            {!accountsLoading && accountsData ? (
                                                <Text size="2" color="gray">
                                                    Учтено расходов за период: {formatCurrency(Number(accountsData.totals.expenseAmount) || 0)}
                                                </Text>
                                            ) : null}
                                        </Flex>
                                    </Flex>

                                    <div className={styles.tableWrapper}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Счет</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Позиций</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Товаров</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Доля</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {accountsLoading ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <PageLoader label="Загрузка отчета..." />
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : accountsData?.expenseByAccount?.length ? (
                                                    accountsData.expenseByAccount.map((row) => (
                                                        <Table.Row key={`expense-${row.account}`} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{getAccountLabel(row.account)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.amount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.positions) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.products) || 0)}</Table.Cell>
                                                            <Table.Cell>{`${Number(row.share || 0).toFixed(1)}%`}</Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                ) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <Text size="2" color="gray">Нет данных</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">Структура затрат по месяцам</Text>
                                    </Flex>
                                    <div className={styles.chartBox}>
                                        {accountsLoading ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : expenseStructureChartData.length ? (
                                            <ResponsiveContainerAny width="100%" height={280}>
                                                <BarChart data={expenseStructureChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                                                    <CartesianGridAny strokeDasharray="3 3" stroke="#eeeeee" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip
                                                        formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0), getAccountLabel(String(name))]}
                                                        labelFormatter={(label: any) => String(label)}
                                                    />
                                                    <Legend formatter={(value: string) => getAccountLabel(value)} />
                                                    {expenseStructureKeys.map((account, idx) => (
                                                        <Bar
                                                            key={account}
                                                            dataKey={account}
                                                            name={account}
                                                            stackId="expense-accounts"
                                                            fill={chartColors[idx % chartColors.length]}
                                                            radius={idx === expenseStructureKeys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                                                        />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainerAny>
                                        ) : (
                                            <Text size="2" color="gray">Нет данных</Text>
                                        )}
                                    </div>
                                </Card>

                                <Card className={styles.chartCardWide}>
                                    <Flex justify="between" align="center" className={styles.blockHeader}>
                                        <Flex direction="column" gap="1">
                                            <Text size="3" weight="bold" className={styles.blockTitle}>
                                                Детализация расходов до товара
                                            </Text>
                                            {!accountsLoading && accountsData?.expenseDetails?.length ? (
                                                <Text size="2" color="gray">
                                                    Топ позиций по расходам внутри счетов затрат
                                                </Text>
                                            ) : null}
                                        </Flex>
                                    </Flex>

                                    <div className={styles.tableWrapper}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Счет</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Записей</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Доля в счете</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Доля общая</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {accountsLoading ? (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={7}>
                                                            <PageLoader label="Загрузка отчета..." />
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ) : accountsData?.expenseDetails?.length ? (
                                                    accountsData.expenseDetails.map((row) => (
                                                        <Table.Row
                                                            key={`expense-detail-${row.account}-${row.productId ?? row.productName}`}
                                                            className={styles.tableRow}
                                                        >
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{getAccountLabel(row.account)}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{row.productName}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{row.nomenclatureType ? formatCell(row.nomenclatureType) : '-'}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(row.amount) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCell(Number(row.records) || 0)}</Table.Cell>
                                                            <Table.Cell>{`${Number(row.shareWithinAccount || 0).toFixed(1)}%`}</Table.Cell>
                                                            <Table.Cell>{`${Number(row.share || 0).toFixed(1)}%`}</Table.Cell>
                                                        </Table.Row>
                                                    ))
                                                ) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={7}>
                                                            <Text size="2" color="gray">Нет данных</Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>
                            </Grid>
                        </Tabs.Content> : null}

                        {canSalesTab ? <Tabs.Content value="sales">
                            <Grid className={styles.blocksGrid} columns={{ initial: '1', md: '2' }} gap="4">
                                <Card className={styles.chartCard}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">Продажи по месяцам</Text>
                                    </Flex>
                                    <div className={styles.chartBox}>
                                        {overviewLoading || !overviewData ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : (
                                            <ResponsiveContainerAny width="100%" height={260}>
                                                <LineChart data={overviewData.byMonth} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                                                    <CartesianGridAny strokeDasharray="3 3" stroke="#eeeeee" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} labelFormatter={(l: any) => String(l)} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainerAny>
                                        )}
                                    </div>
                                </Card>

                                <Card className={styles.chartCard}>
                                    <Flex align="center" gap="2" className={styles.chartHeader}>
                                        <Text size="3" weight="bold">Рентабельность по категориям</Text>
                                    </Flex>
                                    <div className={styles.profitabilityList}>
                                        {overviewLoading || !overviewData ? (
                                            <PageLoader label="Загрузка отчета..." />
                                        ) : overviewData.byCategory.length ? (
                                            <Flex direction="column" gap="4">
                                                {overviewData.byCategory.map((c, idx) => {
                                                    const color = chartColors[idx % chartColors.length];
                                                    const value = Math.max(0, Math.min(100, Number(c.percent) || 0));
                                                    return (
                                                        <div key={c.name} className={styles.profitabilityRow}>
                                                            <Flex justify="between" align="center" className={styles.profitabilityRowHead}>
                                                                <Text size="3" weight="bold" className={styles.profitabilityName}>
                                                                    {c.name}
                                                                </Text>
                                                                <Text size="3" className={styles.profitabilityValue}>
                                                                    {value.toFixed(1)}%
                                                                </Text>
                                                            </Flex>
                                                            <Progress
                                                                value={value}
                                                                size="2"
                                                                radius="full"
                                                                variant="soft"
                                                                style={{ ['--progress-color' as any]: color }}
                                                                className={styles.profitabilityProgress}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </Flex>
                                        ) : (
                                            <Text size="2" color="gray">Нет данных</Text>
                                        )}
                                    </div>
                                </Card>
                            </Grid>
                        </Tabs.Content> : null}

                        {canProductsTab ? <Tabs.Content value="products">
                            <Card className={styles.blockCard}>
                                <Flex justify="between" align="center" className={styles.blockHeader}>
                                    <Text size="3" weight="bold" className={styles.blockTitle}>
                                        Топ товаров по продажам
                                    </Text>
                                </Flex>

                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Продано</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Выручка</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Маржа</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Динамика</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {topProductsLoading ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={5}>
                                                        <PageLoader label="Загрузка отчета..." />
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : topProducts && topProducts.length ? (
                                                topProducts.map((r) => {
                                                    const margin = Number(r.margin_percent) || 0;
                                                    const trend = Number(r.trend_percent) || 0;
                                                    const trendColor = trend >= 0 ? '#16a34a' : '#dc2626';
                                                    const trendText = `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`;
                                                    return (
                                                        <Table.Row key={r.product_id} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{r.product_name}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{`${Number(r.sold_units || 0).toLocaleString('ru-RU')} шт`}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(r.revenue) || 0)}</Table.Cell>
                                                            <Table.Cell>
                                                                <Text size="2" style={{
                                                                    display: 'inline-block',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 999,
                                                                    background: 'rgba(34, 197, 94, 0.12)',
                                                                    color: '#16a34a',
                                                                    fontWeight: 700,
                                                                }}>
                                                                    {`${margin.toFixed(1)}%`}
                                                                </Text>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <Text size="2" style={{ color: trendColor, fontWeight: 700 }}>
                                                                    {trendText}
                                                                </Text>
                                                            </Table.Cell>
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
                                </div>
                            </Card>
                        </Tabs.Content> : null}

                        {canClientsTab ? <Tabs.Content value="clients">
                            <Card className={styles.blockCard}>
                                <Flex justify="between" align="center" className={styles.blockHeader}>
                                    <Text size="3" weight="bold" className={styles.blockTitle}>
                                        Топ клиенты
                                    </Text>
                                </Flex>

                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Заказы</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Выручка</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Средний чек</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Рост</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {topClientsLoading ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={5}>
                                                        <PageLoader label="Загрузка отчета..." />
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : topClients && topClients.length ? (
                                                topClients.map((r) => {
                                                    const growth = Number(r.growth_percent) || 0;
                                                    const growthColor = growth >= 0 ? '#16a34a' : '#dc2626';
                                                    const growthText = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
                                                    return (
                                                        <Table.Row key={r.client_id} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{r.client_name}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{Number(r.orders_count || 0).toLocaleString('ru-RU')}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(r.revenue) || 0)}</Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(r.avg_check) || 0)}</Table.Cell>
                                                            <Table.Cell>
                                                                <Text size="2" style={{ color: growthColor, fontWeight: 700 }}>
                                                                    {growthText}
                                                                </Text>
                                                            </Table.Cell>
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
                                </div>
                            </Card>
                        </Tabs.Content> : null}

                        {canLogisticsTab ? <Tabs.Content value="logistics">
                            <Card className={styles.blockCard}>
                                <Flex justify="between" align="center" className={styles.blockHeader}>
                                    <Text size="3" weight="bold" className={styles.blockTitle}>
                                        Эффективность транспортных компаний
                                    </Text>
                                </Flex>

                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Транспортная компания</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Отгрузки</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Вовремя</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Рейтинг</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Средняя стоимость</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {transportPerfLoading ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={5}>
                                                        <PageLoader label="Загрузка отчета..." />
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : transportPerf && transportPerf.length ? (
                                                transportPerf.map((r) => {
                                                    const rating = Math.max(0, Math.min(100, Number(r.rating_percent) || 0));
                                                    const onTime = Number(r.on_time) || 0;
                                                    const shipments = Number(r.shipments) || 0;
                                                    return (
                                                        <Table.Row key={r.transport_id} className={styles.tableRow}>
                                                            <Table.Cell>
                                                                <div className={styles.cellContent}>{r.transport_name}</div>
                                                            </Table.Cell>
                                                            <Table.Cell>{shipments.toLocaleString('ru-RU')}</Table.Cell>
                                                            <Table.Cell>
                                                                <Flex align="center" gap="2">
                                                                    <Text size="2">{onTime.toLocaleString('ru-RU')}</Text>
                                                                    <Text size="2" style={{
                                                                        display: 'inline-block',
                                                                        padding: '2px 8px',
                                                                        borderRadius: 999,
                                                                        background: 'rgba(34, 197, 94, 0.12)',
                                                                        color: '#16a34a',
                                                                        fontWeight: 700,
                                                                    }}>
                                                                        {`${rating.toFixed(1)}%`}
                                                                    </Text>
                                                                </Flex>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 10,
                                                                }}>
                                                                    <div style={{
                                                                        width: 72,
                                                                        height: 6,
                                                                        borderRadius: 999,
                                                                        background: 'rgba(34, 197, 94, 0.18)',
                                                                        overflow: 'hidden',
                                                                    }}>
                                                                        <div style={{
                                                                            width: `${rating}%`,
                                                                            height: '100%',
                                                                            background: '#22c55e',
                                                                        }} />
                                                                    </div>
                                                                    <Text size="2" style={{ fontWeight: 700 }}>{`${rating.toFixed(1)}%`}</Text>
                                                                </div>
                                                            </Table.Cell>
                                                            <Table.Cell>{formatCurrency(Number(r.avg_cost) || 0)}</Table.Cell>
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
                                </div>
                            </Card>
                        </Tabs.Content> : null}

                        {canCustomTab ? <Tabs.Content value="custom">
                            <Card className={styles.customReportsCard}>
                                <Flex justify="between" align="center" className={styles.customReportsHeader}>
                                    <Text size="3" weight="bold">Пользовательские отчеты</Text>
                                    <Text size="2" color="gray">Отчеты из базы данных</Text>
                                </Flex>

                                <div className={styles.tableWrapper}>
                                    <Table.Root variant="surface" className={styles.table}>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.ColumnHeaderCell>Отчет</Table.ColumnHeaderCell>
                                                <Table.ColumnHeaderCell>Описание</Table.ColumnHeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {reports.map((report) => (
                                                <Table.Row
                                                    key={report.id}
                                                    className={`${styles.tableRow} ${styles.clickableRow}`}
                                                    onClick={() => router.push(`/reports/view?name=${encodeURIComponent(report.viewName)}`)}
                                                    role="link"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            router.push(`/reports/view?name=${encodeURIComponent(report.viewName)}`);
                                                        }
                                                    }}
                                                >
                                                    <Table.Cell>
                                                        <div className={styles.customReportTitle}>{report.title}</div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className={styles.customReportDesc}>{report.description}</div>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table.Root>
                                </div>
                            </Card>
                        </Tabs.Content> : null}
                    </div>
                </Tabs.Root>
            </div>
        </div>
    );
};

export default withLayout(ReportsPage);
