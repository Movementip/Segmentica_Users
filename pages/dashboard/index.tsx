import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { withLayout } from '../../layout';
import { useAuth } from '../../context/AuthContext';
import { NoAccessPage } from '../../components/NoAccessPage';
import { getDashboardAccess } from '../../lib/dashboardRbac';
import styles from './Dashboard.module.css';
import { Card, Flex, Grid, Heading, Separator, Table, Text } from '@radix-ui/themes';
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
import {
    FiAlertTriangle,
    FiArrowRight,
    FiBarChart2,
    FiClock,
    FiPackage,
    FiShoppingCart,
    FiTruck as FiTruckIcon
} from 'react-icons/fi';

interface DashboardStats {
    activeOrders: number;
    totalProducts: number;
    activeSuppliers: number;
    lowStockItems: number;
    monthlyRevenue: number;
    pendingShipments: number;
    recentOrders: Array<{
        id: number;
        client: string;
        amount: number;
        status: string;
        created_at: string;
    }>;
    stockByCategory: Array<{
        category: string;
        count: number;
    }>;
    warehouseMovements: Array<{
        id: number;
        product_name: string;
        quantity: number;
        operation_type: string;
        operation_date: string;
        comment: string;
        order_id: string;
        purchase_id: string;
    }>;
    salesByPeriod: Array<{
        период: string;
        количество_продаж: number;
        общая_сумма: number;
        средний_чек: number;
    }>;
}

type ChartTooltipValue = number | string | ReadonlyArray<number | string> | undefined;

const normalizeChartTooltipValue = (value: ChartTooltipValue): number | string => {
    const scalarValue = Array.isArray(value) ? value[0] : value;
    return scalarValue ?? 0;
};

type Period = '6m';

const DASHBOARD_PERIOD: Period = '6m';

type OverviewResponse = {
    byMonth: Array<{ month: string; revenue: number; expense: number; profit: number; orders: number }>;
    byCategory: Array<{ name: string; value: number; percent: number }>;
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

const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('ru-RU');
};

const formatNumber = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
};

const formatCurrency = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(n);
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
        case 'собрана':
            return '#5d4037';
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

const SALES_BAR_COLOR = '#111827';
const PIE_COLORS = ['#111827', '#2563eb', '#16a34a', '#f97316', '#7c3aed', '#ef4444'];

const Home: NextPage = (): JSX.Element => {
    const { user, loading: authLoading } = useAuth();
    const dashboardAccess = useMemo(() => getDashboardAccess(user?.permissions), [user?.permissions]);

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [overview, setOverview] = useState<OverviewResponse | null>(null);
    const [topProducts, setTopProducts] = useState<TopProductRow[] | null>(null);
    const [topClients, setTopClients] = useState<TopClientRow[] | null>(null);
    const [transport, setTransport] = useState<TransportPerformanceRow[] | null>(null);

    const canOpenOrderCard = Boolean(user?.permissions?.includes('orders.view'));
    const canOpenOrdersList = Boolean(user?.permissions?.includes('orders.list'));
    const canOpenWarehouse = Boolean(user?.permissions?.includes('warehouse.list'));
    const canOpenProducts = Boolean(user?.permissions?.includes('products.list'));
    const canOpenReportsSales = Boolean(user?.permissions?.includes('reports.sales.view'));

    useEffect(() => {
        let isCancelled = false;

        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                const tasks: Promise<void>[] = [];

                if (dashboardAccess.canDashboardDataApi) {
                    tasks.push((async () => {
                        const res = await fetch('/api/dashboard');
                        if (!res.ok) throw new Error('Ошибка при загрузке данных дашборда');
                        const dashData = (await res.json()) as DashboardStats;
                        if (!isCancelled) setStats(dashData);
                    })());
                } else if (!isCancelled) {
                    setStats(null);
                }

                if (dashboardAccess.canFinanceChart) {
                    tasks.push((async () => {
                        const res = await fetch(`/api/reports/overview?period=${encodeURIComponent(DASHBOARD_PERIOD)}`);
                        if (!res.ok) throw new Error('Ошибка при загрузке финансового блока');
                        const json = (await res.json()) as OverviewResponse;
                        if (!isCancelled) setOverview(json);
                    })());
                } else if (!isCancelled) {
                    setOverview(null);
                }

                if (dashboardAccess.canTopProducts) {
                    tasks.push((async () => {
                        const res = await fetch(`/api/reports/top-products?period=${encodeURIComponent(DASHBOARD_PERIOD)}`);
                        if (!res.ok) throw new Error('Ошибка при загрузке блока "Топ товары"');
                        const json = (await res.json()) as { data: TopProductRow[] };
                        if (!isCancelled) setTopProducts(Array.isArray(json.data) ? json.data : []);
                    })());
                } else if (!isCancelled) {
                    setTopProducts(null);
                }

                if (dashboardAccess.canTopClients) {
                    tasks.push((async () => {
                        const res = await fetch(`/api/reports/top-clients?period=${encodeURIComponent(DASHBOARD_PERIOD)}`);
                        if (!res.ok) throw new Error('Ошибка при загрузке блока "Топ клиенты"');
                        const json = (await res.json()) as { data: TopClientRow[] };
                        if (!isCancelled) setTopClients(Array.isArray(json.data) ? json.data : []);
                    })());
                } else if (!isCancelled) {
                    setTopClients(null);
                }

                if (dashboardAccess.canTransportPerformance) {
                    tasks.push((async () => {
                        const res = await fetch(`/api/reports/transport-performance?period=${encodeURIComponent(DASHBOARD_PERIOD)}`);
                        if (!res.ok) throw new Error('Ошибка при загрузке блока "Логистика"');
                        const json = (await res.json()) as { data: TransportPerformanceRow[] };
                        if (!isCancelled) setTransport(Array.isArray(json.data) ? json.data : []);
                    })());
                } else if (!isCancelled) {
                    setTransport(null);
                }

                if (!tasks.length) {
                    if (!isCancelled) setLoading(false);
                    return;
                }

                await Promise.all(tasks);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                if (!isCancelled) {
                    setError('Не удалось загрузить данные. Пожалуйста, обновите страницу.');
                }
            } finally {
                if (!isCancelled) setLoading(false);
            }
        };

        if (authLoading) return () => undefined;

        if (!dashboardAccess.canDashboard) {
            setStats(null);
            setOverview(null);
            setTopProducts(null);
            setTopClients(null);
            setTransport(null);
            setError(null);
            setLoading(false);
            return () => undefined;
        }

        void fetchDashboardData();

        return () => {
            isCancelled = true;
        };
    }, [authLoading, dashboardAccess]);

    if (authLoading || loading) {
        return <div className={styles.loading}><div>Загрузка...</div></div>;
    }

    if (!dashboardAccess.canDashboard) {
        return <NoAccessPage />;
    }

    if (error) {
        return <div className={styles.error}><FiAlertTriangle /> {error}</div>;
    }

    if (dashboardAccess.canDashboardDataApi && !stats) {
        return <div className={styles.error}>Нет данных для отображения</div>;
    }

    const salesData = (stats?.salesByPeriod || [])
        .map((s) => ({
            period: formatDate(String(s.период)),
            orders: Number(s.количество_продаж) || 0,
            revenue: Number(s.общая_сумма) || 0,
        }))
        .slice(-12);

    const pieData = (stats?.stockByCategory || [])
        .map((c) => ({ name: c.category || 'Без категории', value: Number(c.count) || 0 }))
        .filter((x) => x.value > 0)
        .slice(0, 8);

    const financeChartData = (overview?.byMonth || []).map((m) => ({
        month: m.month,
        revenue: Number(m.revenue) || 0,
        expense: Number(m.expense) || 0,
        profit: Number(m.profit) || 0
    }));

    const salesLink = canOpenOrdersList ? '/orders' : (canOpenReportsSales ? '/reports?tab=sales' : null);
    const stockLink = canOpenWarehouse ? '/warehouse' : (canOpenProducts ? '/products' : null);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Панель управления</h1>
                    <p className={styles.subtitle}>Короткий обзор текущей активности и быстрый доступ к важным разделам</p>
                </div>
            </div>

            <div className={styles.surface}>
                <div className={styles.stack}>
                    {dashboardAccess.canQuickActions ? (
                        <Card className={styles.cardtop}>
                            <Flex justify="between" align="center" className={styles.cardHeader}>
                                <div>
                                    <Heading size="3">Быстрые действия</Heading>
                                    <Text size="2" color="gray">Переход к ключевым разделам</Text>
                                </div>
                            </Flex>

                            <Grid columns={{ initial: '1', sm: '2', md: '3', lg: '5' }} gap="3" className={styles.actionsGrid}>
                                {dashboardAccess.quickActions.products ? (
                                    <Link href="/products" className={styles.actionCard}>
                                        <FiPackage className={styles.actionIcon} />
                                        <div className={styles.actionTitle}>Товары</div>
                                        <div className={styles.actionHint}>Добавить / посмотреть</div>
                                    </Link>
                                ) : null}

                                {dashboardAccess.quickActions.suppliers ? (
                                    <Link href="/suppliers" className={styles.actionCard}>
                                        <FiTruckIcon className={styles.actionIcon} />
                                        <div className={styles.actionTitle}>Поставщики</div>
                                        <div className={styles.actionHint}>Создать / список</div>
                                    </Link>
                                ) : null}

                                {dashboardAccess.quickActions.orders ? (
                                    <Link href="/orders" className={styles.actionCard}>
                                        <FiClock className={styles.actionIcon} />
                                        <div className={styles.actionTitle}>Заказы</div>
                                        <div className={styles.actionHint}>Управление заказами</div>
                                    </Link>
                                ) : null}

                                {dashboardAccess.quickActions.purchases ? (
                                    <Link href="/purchases" className={styles.actionCard}>
                                        <FiShoppingCart className={styles.actionIcon} />
                                        <div className={styles.actionTitle}>Закупки</div>
                                        <div className={styles.actionHint}>Оформить закупку</div>
                                    </Link>
                                ) : null}

                                {dashboardAccess.quickActions.reports ? (
                                    <Link href="/reports" className={styles.actionCard}>
                                        <FiBarChart2 className={styles.actionIcon} />
                                        <div className={styles.actionTitle}>Отчёты</div>
                                        <div className={styles.actionHint}>Аналитика и выгрузки</div>
                                    </Link>
                                ) : null}
                            </Grid>
                        </Card>
                    ) : null}

                    {dashboardAccess.canSummaryStats ? (
                        <Card className={styles.statsContainer}>
                            <div className={styles.statsGridOrdersStyle}>
                                {dashboardAccess.statsCards.activeOrders ? (
                                    <div className={styles.statCardOrdersStyle}>
                                        <div className={styles.statValueOrdersStyle}>{formatNumber(stats?.activeOrders)}</div>
                                        <div className={styles.statLabelOrdersStyle}>Активные заказы</div>
                                    </div>
                                ) : null}

                                {dashboardAccess.statsCards.totalProducts ? (
                                    <div className={styles.statCardOrdersStyle}>
                                        <div className={styles.statValueOrdersStyle}>{formatNumber(stats?.totalProducts)}</div>
                                        <div className={styles.statLabelOrdersStyle}>Товары на складе</div>
                                    </div>
                                ) : null}

                                {dashboardAccess.statsCards.activeSuppliers ? (
                                    <div className={styles.statCardOrdersStyle}>
                                        <div className={styles.statValueOrdersStyle}>{formatNumber(stats?.activeSuppliers)}</div>
                                        <div className={styles.statLabelOrdersStyle}>Поставщики</div>
                                    </div>
                                ) : null}

                                {dashboardAccess.statsCards.lowStockItems ? (
                                    <div className={styles.statCardOrdersStyle}>
                                        <div className={`${styles.statValueOrdersStyle} ${styles.statCritical}`}>{formatNumber(stats?.lowStockItems)}</div>
                                        <div className={styles.statLabelOrdersStyle}>Низкий запас</div>
                                    </div>
                                ) : null}
                            </div>
                        </Card>
                    ) : null}

                    {dashboardAccess.canSalesChart || dashboardAccess.canStockByCategory ? (
                        <div className={styles.mainGrid}>
                            {dashboardAccess.canSalesChart ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Продажи</Heading>
                                            <Text size="2" color="gray">Динамика выручки по периодам</Text>
                                        </div>
                                        {salesLink ? (
                                            <Link href={salesLink} className={styles.viewAll}>
                                                Подробнее <FiArrowRight />
                                            </Link>
                                        ) : null}
                                    </Flex>

                                    <div className={styles.chartWrap}>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={salesData} margin={{ top: 8, right: 32, left: 16, bottom: 12 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis
                                                    dataKey="period"
                                                    tick={{ fontSize: 11 }}
                                                    interval="preserveStartEnd"
                                                    padding={{ left: 10, right: 10 }}
                                                    tickMargin={8}
                                                    minTickGap={12}
                                                />
                                                <YAxis tick={{ fontSize: 11 }} width={48} />
                                                <Tooltip
                                                    formatter={(v: ChartTooltipValue, name) => {
                                                        const normalizedValue = normalizeChartTooltipValue(v);
                                                        if (name === 'revenue') return [formatCurrency(normalizedValue), 'Выручка'];
                                                        if (name === 'orders') return [formatNumber(normalizedValue), 'Продажи'];
                                                        return [String(normalizedValue), String(name ?? '')];
                                                    }}
                                                />
                                                <Bar dataKey="revenue" fill={SALES_BAR_COLOR} radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            ) : null}

                            {dashboardAccess.canStockByCategory ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Склад по категориям</Heading>
                                            <Text size="2" color="gray">Структура ассортимента</Text>
                                        </div>
                                        {stockLink ? (
                                            <Link href={stockLink} className={styles.viewAll}>
                                                Открыть <FiArrowRight />
                                            </Link>
                                        ) : null}
                                    </Flex>

                                    <div className={styles.pieWrap}>
                                        {pieData.length ? (
                                            <ResponsiveContainer width="100%" height={280}>
                                                <PieChart>
                                                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                                                        {pieData.map((_, idx) => (
                                                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(v: ChartTooltipValue) => formatNumber(normalizeChartTooltipValue(v))} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className={styles.emptyState}>Нет данных</div>
                                        )}
                                    </div>

                                    <Separator size="4" className={styles.divider} />
                                    <div className={styles.pieLegend}>
                                        {pieData.map((c, idx) => (
                                            <div key={c.name} className={styles.legendRow}>
                                                <span className={styles.legendDot} style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                                <span className={styles.legendName}>{c.name}</span>
                                                <span className={styles.legendValue}>{formatNumber(c.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            ) : null}
                        </div>
                    ) : null}

                    {dashboardAccess.canRecentOrders ? (
                        <Card className={styles.card}>
                            <Flex justify="between" align="center" className={styles.cardHeader}>
                                <div>
                                    <Heading size="3">Последние заказы</Heading>
                                    <Text size="2" color="gray">Что сейчас в работе</Text>
                                </div>
                                <Link href="/orders" className={styles.viewAll}>
                                    Показать все <FiArrowRight />
                                </Link>
                            </Flex>

                            <div className={styles.tableWrap}>
                                <Table.Root variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Заказ</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Контрагент</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Сумма</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell className={styles.statusCell}>
                                                <span className={styles.statusHeaderLabel}>Статус</span>
                                            </Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {(stats?.recentOrders || []).length ? (stats?.recentOrders || []).map((order) => (
                                            <Table.Row key={order.id}>
                                                <Table.Cell>
                                                    {canOpenOrderCard ? (
                                                        <Link href={`/orders/${order.id}`} className={styles.rowLink}>#{order.id}</Link>
                                                    ) : (
                                                        <span className={styles.rowLink}>#{order.id}</span>
                                                    )}
                                                </Table.Cell>
                                                <Table.Cell>{order.client}</Table.Cell>
                                                <Table.Cell className={styles.monoCell}>{formatDate(order.created_at)}</Table.Cell>
                                                <Table.Cell className={styles.monoCell}>{formatCurrency(order.amount)}</Table.Cell>
                                                <Table.Cell className={styles.statusCell}>
                                                    <div
                                                        className={styles.statusBadge}
                                                        style={{
                                                            backgroundColor: `${getStatusColor(order.status)}15`,
                                                            color: getStatusColor(order.status),
                                                            border: `1px solid ${getStatusColor(order.status)}40`
                                                        }}
                                                    >
                                                        {order.status}
                                                    </div>
                                                </Table.Cell>
                                            </Table.Row>
                                        )) : (
                                            <Table.Row>
                                                <Table.Cell colSpan={5}>
                                                    <div className={styles.emptyRow}>Нет данных</div>
                                                </Table.Cell>
                                            </Table.Row>
                                        )}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        </Card>
                    ) : null}

                    {dashboardAccess.canWarehouseMovements ? (
                        <Card className={styles.card}>
                            <Flex justify="between" align="center" className={styles.cardHeader}>
                                <div>
                                    <Heading size="3">Движения по складу</Heading>
                                    <Text size="2" color="gray">Последние операции</Text>
                                </div>
                                <Link href="/warehouse?tab=movements" className={styles.viewAll}>
                                    Показать все <FiArrowRight />
                                </Link>
                            </Flex>

                            <div className={styles.tableWrap}>
                                <Table.Root variant="surface" className={styles.table}>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Кол-во</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Тип</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Дата</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Заказ</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>Закупка</Table.ColumnHeaderCell>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {(stats?.warehouseMovements || []).slice(0, 12).length ? (stats?.warehouseMovements || []).slice(0, 12).map((m) => (
                                            <Table.Row key={m.id}>
                                                <Table.Cell>
                                                    <div className={styles.cellTitle}>{m.product_name}</div>
                                                    {m.comment ? <div className={styles.cellSub}>{m.comment}</div> : null}
                                                </Table.Cell>
                                                <Table.Cell className={styles.monoCell}>
                                                    <span
                                                        className={`${styles.movementQty} ${m.operation_type === 'приход' ? styles.movementQtyIn : styles.movementQtyOut}`}
                                                    >
                                                        {m.operation_type === 'приход' ? '+' : '-'}{formatNumber(Math.abs(Number(m.quantity) || 0))}
                                                    </span>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <span className={`${styles.badge} ${m.operation_type === 'приход' ? styles.badgeIn : styles.badgeOut}`}>
                                                        {m.operation_type}
                                                    </span>
                                                </Table.Cell>
                                                <Table.Cell className={styles.monoCell}>{formatDate(m.operation_date)}</Table.Cell>
                                                <Table.Cell className={styles.monoCell}>{m.order_id || '—'}</Table.Cell>
                                                <Table.Cell className={styles.monoCell}>{m.purchase_id || '—'}</Table.Cell>
                                            </Table.Row>
                                        )) : (
                                            <Table.Row>
                                                <Table.Cell colSpan={6}>
                                                    <div className={styles.emptyRow}>Нет данных</div>
                                                </Table.Cell>
                                            </Table.Row>
                                        )}
                                    </Table.Body>
                                </Table.Root>
                            </div>
                        </Card>
                    ) : null}

                    {dashboardAccess.canFinanceChart ||
                    dashboardAccess.canTopProducts ||
                    dashboardAccess.canTopClients ||
                    dashboardAccess.canTransportPerformance ? (
                        <div className={styles.extraGrid}>
                            {dashboardAccess.canFinanceChart ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Финансы</Heading>
                                            <Text size="2" color="gray">Выручка, расходы и прибыль по месяцам</Text>
                                        </div>
                                        <Link href="/reports?tab=overview" className={styles.viewAll}>
                                            Открыть отчёты <FiArrowRight />
                                        </Link>
                                    </Flex>

                                    {financeChartData.length ? (
                                        <div className={styles.chartWrap}>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={financeChartData} margin={{ top: 8, right: 32, left: 16, bottom: 12 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis
                                                        dataKey="month"
                                                        tick={{ fontSize: 11 }}
                                                        padding={{ left: 10, right: 10 }}
                                                        tickMargin={8}
                                                        minTickGap={12}
                                                    />
                                                    <YAxis tick={{ fontSize: 11 }} width={54} />
                                                    <Tooltip formatter={(v: ChartTooltipValue, name) => [formatCurrency(normalizeChartTooltipValue(v)), String(name ?? '')]} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#111827" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="expense" name="Расходы" stroke="#ef4444" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#16a34a" strokeWidth={2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className={styles.emptyState}>Нет данных</div>
                                    )}
                                </Card>
                            ) : null}

                            {dashboardAccess.canTopProducts ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Топ товары</Heading>
                                            <Text size="2" color="gray">По выручке за период</Text>
                                        </div>
                                        <Link href="/reports?tab=products" className={styles.viewAll}>
                                            Открыть <FiArrowRight />
                                        </Link>
                                    </Flex>

                                    <div className={styles.tableWrap}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Товар</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Шт.</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Выручка</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Маржа %</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Тренд %</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {(topProducts || []).length ? (topProducts || []).map((r) => (
                                                    <Table.Row key={r.product_id}>
                                                        <Table.Cell>
                                                            <div className={styles.cellTitle}>{r.product_name}</div>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.sold_units)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatCurrency(r.revenue)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.margin_percent)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.trend_percent)}</Table.Cell>
                                                    </Table.Row>
                                                )) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <div className={styles.emptyRow}>Нет данных</div>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>
                            ) : null}

                            {dashboardAccess.canTopClients ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Топ клиенты</Heading>
                                            <Text size="2" color="gray">По выручке за период</Text>
                                        </div>
                                        <Link href="/reports?tab=clients" className={styles.viewAll}>
                                            Открыть <FiArrowRight />
                                        </Link>
                                    </Flex>

                                    <div className={styles.tableWrap}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>Клиент</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Заказов</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Выручка</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Средний чек</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Рост %</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {(topClients || []).length ? (topClients || []).map((r) => (
                                                    <Table.Row key={r.client_id}>
                                                        <Table.Cell>
                                                            <div className={styles.cellTitle}>{r.client_name}</div>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.orders_count)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatCurrency(r.revenue)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatCurrency(r.avg_check)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.growth_percent)}</Table.Cell>
                                                    </Table.Row>
                                                )) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <div className={styles.emptyRow}>Нет данных</div>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>
                            ) : null}

                            {dashboardAccess.canTransportPerformance ? (
                                <Card className={styles.card}>
                                    <Flex justify="between" align="center" className={styles.cardHeader}>
                                        <div>
                                            <Heading size="3">Логистика</Heading>
                                            <Text size="2" color="gray">Эффективность транспортных компаний</Text>
                                        </div>
                                        <Link href="/reports?tab=logistics" className={styles.viewAll}>
                                            Открыть <FiArrowRight />
                                        </Link>
                                    </Flex>

                                    <div className={styles.tableWrap}>
                                        <Table.Root variant="surface" className={styles.table}>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.ColumnHeaderCell>ТК</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Отгрузок</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Вовремя</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Рейтинг %</Table.ColumnHeaderCell>
                                                    <Table.ColumnHeaderCell>Ср. стоимость</Table.ColumnHeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {(transport || []).length ? (transport || []).map((r) => (
                                                    <Table.Row key={r.transport_id}>
                                                        <Table.Cell>
                                                            <div className={styles.cellTitle}>{r.transport_name}</div>
                                                        </Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.shipments)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.on_time)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatNumber(r.rating_percent)}</Table.Cell>
                                                        <Table.Cell className={styles.monoCell}>{formatCurrency(r.avg_cost)}</Table.Cell>
                                                    </Table.Row>
                                                )) : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={5}>
                                                            <div className={styles.emptyRow}>Нет данных</div>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table.Root>
                                    </div>
                                </Card>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default withLayout(Home);
