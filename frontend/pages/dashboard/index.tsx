import React, { useEffect, useMemo, useState } from "react"
import type { NextPage } from "next"
import Link from "next/link"
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
  YAxis,
} from "recharts"
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiClock,
  FiPackage,
  FiShoppingCart,
  FiTruck as FiTruckIcon,
} from "react-icons/fi"

import { DashboardQuickActions, type DashboardQuickActionItem } from "@/components/dashboard/DashboardQuickActions/DashboardQuickActions"
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard/DashboardSectionCard"
import { DashboardSummaryStats, type DashboardSummaryStatItem } from "@/components/dashboard/DashboardSummaryStats/DashboardSummaryStats"
import { EntityTableSurface, entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { EntityStatusBadge } from "@/components/EntityStatusBadge/EntityStatusBadge"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/context/AuthContext"
import { withLayout } from "@/layout"
import { getDashboardAccess } from "@/lib/dashboardRbac"
import { cn } from "@/lib/utils"

import styles from "./Dashboard.module.css"

interface DashboardStats {
  activeOrders: number
  totalProducts: number
  activeSuppliers: number
  lowStockItems: number
  monthlyRevenue: number
  pendingShipments: number
  recentOrders: Array<{
    id: number
    client: string
    amount: number
    status: string
    created_at: string
  }>
  stockByCategory: Array<{
    category: string
    count: number
  }>
  warehouseMovements: Array<{
    id: number
    product_name: string
    quantity: number
    operation_type: string
    operation_date: string
    comment: string
    order_id: string
    purchase_id: string
  }>
  salesByPeriod: Array<{
    период: string
    количество_продаж: number
    общая_сумма: number
    средний_чек: number
  }>
}

type ChartTooltipValue = number | string | ReadonlyArray<number | string> | undefined

const normalizeChartTooltipValue = (value: ChartTooltipValue): number | string => {
  const scalarValue = Array.isArray(value) ? value[0] : value
  return scalarValue ?? 0
}

type Period = "6m"

const DASHBOARD_PERIOD: Period = "6m"

type OverviewResponse = {
  byMonth: Array<{ month: string; revenue: number; expense: number; profit: number; orders: number }>
  byCategory: Array<{ name: string; value: number; percent: number }>
}

type TopProductRow = {
  product_id: number
  product_name: string
  sold_units: number
  revenue: number
  margin_percent: number
  trend_percent: number
}

type TopClientRow = {
  client_id: number
  client_name: string
  orders_count: number
  revenue: number
  avg_check: number
  growth_percent: number
}

type TransportPerformanceRow = {
  transport_id: number
  transport_name: string
  shipments: number
  on_time: number
  rating_percent: number
  avg_cost: number
}

const SALES_BAR_COLOR = "#111827"
const PIE_COLORS = ["#111827", "#2563eb", "#16a34a", "#f97316", "#7c3aed", "#ef4444"]

const chartAxisTick = { fontSize: 11, fill: "var(--muted-foreground)" }
const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  color: "var(--popover-foreground)",
}
const chartCursorStyle = { fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("ru-RU")
}

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return "—"
  const normalized = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(normalized)) return String(value)
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(normalized)
}

const formatCurrency = (value: unknown) => {
  const normalized = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(normalized)) return "—"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(normalized)
}

function DashboardPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth()
  const dashboardAccess = useMemo(
    () => getDashboardAccess(user?.permissions),
    [user?.permissions]
  )

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [topProducts, setTopProducts] = useState<TopProductRow[] | null>(null)
  const [topClients, setTopClients] = useState<TopClientRow[] | null>(null)
  const [transport, setTransport] = useState<TransportPerformanceRow[] | null>(null)

  const canOpenOrderCard = Boolean(user?.permissions?.includes("orders.view"))
  const canOpenOrdersList = Boolean(user?.permissions?.includes("orders.list"))
  const canOpenWarehouse = Boolean(user?.permissions?.includes("warehouse.list"))
  const canOpenProducts = Boolean(user?.permissions?.includes("products.list"))
  const canOpenReportsSales = Boolean(user?.permissions?.includes("reports.sales.view"))

  useEffect(() => {
    let isCancelled = false

    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const tasks: Promise<void>[] = []

        if (dashboardAccess.canDashboardDataApi) {
          tasks.push((async () => {
            const response = await fetch("/api/dashboard")
            if (!response.ok) throw new Error("Ошибка при загрузке данных дашборда")
            const dashboardData = (await response.json()) as DashboardStats
            if (!isCancelled) setStats(dashboardData)
          })())
        } else if (!isCancelled) {
          setStats(null)
        }

        if (dashboardAccess.canFinanceChart) {
          tasks.push((async () => {
            const response = await fetch(
              `/api/reports/overview?period=${encodeURIComponent(DASHBOARD_PERIOD)}`
            )
            if (!response.ok) throw new Error("Ошибка при загрузке финансового блока")
            const json = (await response.json()) as OverviewResponse
            if (!isCancelled) setOverview(json)
          })())
        } else if (!isCancelled) {
          setOverview(null)
        }

        if (dashboardAccess.canTopProducts) {
          tasks.push((async () => {
            const response = await fetch(
              `/api/reports/top-products?period=${encodeURIComponent(DASHBOARD_PERIOD)}`
            )
            if (!response.ok) throw new Error("Ошибка при загрузке блока \"Топ товары\"")
            const json = (await response.json()) as { data: TopProductRow[] }
            if (!isCancelled) setTopProducts(Array.isArray(json.data) ? json.data : [])
          })())
        } else if (!isCancelled) {
          setTopProducts(null)
        }

        if (dashboardAccess.canTopClients) {
          tasks.push((async () => {
            const response = await fetch(
              `/api/reports/top-clients?period=${encodeURIComponent(DASHBOARD_PERIOD)}`
            )
            if (!response.ok) throw new Error("Ошибка при загрузке блока \"Топ клиенты\"")
            const json = (await response.json()) as { data: TopClientRow[] }
            if (!isCancelled) setTopClients(Array.isArray(json.data) ? json.data : [])
          })())
        } else if (!isCancelled) {
          setTopClients(null)
        }

        if (dashboardAccess.canTransportPerformance) {
          tasks.push((async () => {
            const response = await fetch(
              `/api/reports/transport-performance?period=${encodeURIComponent(DASHBOARD_PERIOD)}`
            )
            if (!response.ok) throw new Error("Ошибка при загрузке блока \"Логистика\"")
            const json = (await response.json()) as { data: TransportPerformanceRow[] }
            if (!isCancelled) setTransport(Array.isArray(json.data) ? json.data : [])
          })())
        } else if (!isCancelled) {
          setTransport(null)
        }

        if (!tasks.length) {
          if (!isCancelled) setLoading(false)
          return
        }

        await Promise.all(tasks)
      } catch (loadError) {
        console.error("Error fetching dashboard data:", loadError)
        if (!isCancelled) {
          setError("Не удалось загрузить данные. Пожалуйста, обновите страницу.")
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    if (authLoading) return () => undefined

    if (!dashboardAccess.canDashboard) {
      setStats(null)
      setOverview(null)
      setTopProducts(null)
      setTopClients(null)
      setTransport(null)
      setError(null)
      setLoading(false)
      return () => undefined
    }

    void fetchDashboardData()

    return () => {
      isCancelled = true
    }
  }, [authLoading, dashboardAccess])

  const quickActionItems = useMemo((): DashboardQuickActionItem[] => {
    const next: DashboardQuickActionItem[] = []

    if (dashboardAccess.quickActions.products) {
      next.push({
        href: "/products",
        icon: <FiPackage />,
        title: "Товары",
        hint: "Добавить / посмотреть",
      })
    }

    if (dashboardAccess.quickActions.suppliers) {
      next.push({
        href: "/suppliers",
        icon: <FiTruckIcon />,
        title: "Поставщики",
        hint: "Создать / список",
      })
    }

    if (dashboardAccess.quickActions.orders) {
      next.push({
        href: "/orders",
        icon: <FiClock />,
        title: "Заказы",
        hint: "Управление заказами",
      })
    }

    if (dashboardAccess.quickActions.purchases) {
      next.push({
        href: "/purchases",
        icon: <FiShoppingCart />,
        title: "Закупки",
        hint: "Оформить закупку",
      })
    }

    if (dashboardAccess.quickActions.reports) {
      next.push({
        href: "/reports",
        icon: <FiBarChart2 />,
        title: "Отчёты",
        hint: "Аналитика и выгрузки",
      })
    }

    return next
  }, [dashboardAccess.quickActions])

  const summaryItems = useMemo((): DashboardSummaryStatItem[] => {
    if (!stats) return []

    const next: Array<DashboardSummaryStatItem | null> = [
      dashboardAccess.statsCards.activeOrders
        ? { label: "Активные заказы", value: formatNumber(stats.activeOrders) }
        : null,
      dashboardAccess.statsCards.totalProducts
        ? { label: "Товары на складе", value: formatNumber(stats.totalProducts) }
        : null,
      dashboardAccess.statsCards.activeSuppliers
        ? { label: "Поставщики", value: formatNumber(stats.activeSuppliers) }
        : null,
      dashboardAccess.statsCards.lowStockItems
        ? { label: "Низкий запас", value: formatNumber(stats.lowStockItems), tone: "warning" as const }
        : null,
    ]

    return next.filter((item): item is DashboardSummaryStatItem => item !== null)
  }, [dashboardAccess.statsCards, stats])

  const salesData = useMemo(
    () =>
      (stats?.salesByPeriod || [])
        .map((item) => ({
          period: formatDate(String(item.период)),
          orders: Number(item.количество_продаж) || 0,
          revenue: Number(item.общая_сумма) || 0,
        }))
        .slice(-12),
    [stats?.salesByPeriod]
  )

  const pieData = useMemo(
    () =>
      (stats?.stockByCategory || [])
        .map((item) => ({
          name: item.category || "Без категории",
          value: Number(item.count) || 0,
        }))
        .filter((item) => item.value > 0)
        .slice(0, 8),
    [stats?.stockByCategory]
  )

  const financeChartData = useMemo(
    () =>
      (overview?.byMonth || []).map((item) => ({
        month: item.month,
        revenue: Number(item.revenue) || 0,
        expense: Number(item.expense) || 0,
        profit: Number(item.profit) || 0,
      })),
    [overview?.byMonth]
  )

  const salesLink = canOpenOrdersList
    ? "/orders"
    : canOpenReportsSales
      ? "/reports?tab=sales"
      : null
  const stockLink = canOpenWarehouse
    ? "/warehouse"
    : canOpenProducts
      ? "/products"
      : null

  if (authLoading || loading) {
    return <PageLoader label="Загрузка..." fullPage />
  }

  if (!dashboardAccess.canDashboard) {
    return <NoAccessPage />
  }

  if (error) {
    return (
      <div className={styles.error}>
        <FiAlertTriangle />
        <span>{error}</span>
      </div>
    )
  }

  if (dashboardAccess.canDashboardDataApi && !stats) {
    return <div className={styles.error}>Нет данных для отображения</div>
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Панель управления"
        subtitle="Короткий обзор текущей активности и быстрый доступ к важным разделам"
      />

      <div className={styles.stack}>
        {dashboardAccess.canQuickActions && quickActionItems.length ? (
          <DashboardSectionCard
            title="Быстрые действия"
            description="Переход к ключевым разделам"
          >
            <DashboardQuickActions items={quickActionItems} />
          </DashboardSectionCard>
        ) : null}

        {dashboardAccess.canSummaryStats && summaryItems.length ? (
          <DashboardSummaryStats items={summaryItems} />
        ) : null}

        {dashboardAccess.canSalesChart || dashboardAccess.canStockByCategory ? (
          <div className={styles.mainGrid}>
            {dashboardAccess.canSalesChart ? (
              <DashboardSectionCard
                title="Продажи"
                description="Динамика выручки по периодам"
                action={
                  salesLink ? (
                    <Link href={salesLink} className={styles.linkAction}>
                      Подробнее <FiArrowRight />
                    </Link>
                  ) : null
                }
                contentClassName={styles.chartContent}
              >
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={salesData}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="period"
                        tick={chartAxisTick}
                        interval="preserveStartEnd"
                        padding={{ left: 10, right: 10 }}
                        tickMargin={8}
                        minTickGap={12}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={chartAxisTick}
                        width={52}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={chartCursorStyle}
                        contentStyle={chartTooltipStyle}
                        formatter={(value: ChartTooltipValue, name) => {
                          const normalizedValue = normalizeChartTooltipValue(value)
                          if (name === "revenue") {
                            return [formatCurrency(normalizedValue), "Выручка"]
                          }

                          if (name === "orders") {
                            return [formatNumber(normalizedValue), "Продажи"]
                          }

                          return [String(normalizedValue), String(name ?? "")]
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill={SALES_BAR_COLOR}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashboardSectionCard>
            ) : null}

            {dashboardAccess.canStockByCategory ? (
              <DashboardSectionCard
                title="Склад по категориям"
                description="Структура ассортимента"
                action={
                  stockLink ? (
                    <Link href={stockLink} className={styles.linkAction}>
                      Открыть <FiArrowRight />
                    </Link>
                  ) : null
                }
                contentClassName={styles.chartContent}
              >
                <div className={styles.pieWrap}>
                  {pieData.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`pie-segment-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: ChartTooltipValue) =>
                            formatNumber(normalizeChartTooltipValue(value))
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={styles.emptyState}>Нет данных</div>
                  )}
                </div>

                {pieData.length ? <div className={styles.divider} /> : null}

                {pieData.length ? (
                  <div className={styles.pieLegend}>
                    {pieData.map((item, index) => (
                      <div key={item.name} className={styles.legendRow}>
                        <span
                          className={styles.legendDot}
                          style={{
                            backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                          }}
                        />
                        <span className={styles.legendName}>{item.name}</span>
                        <span className={styles.legendValue}>{formatNumber(item.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </DashboardSectionCard>
            ) : null}
          </div>
        ) : null}

        {dashboardAccess.canRecentOrders ? (
          <DashboardSectionCard
            title="Последние заказы"
            description="Что сейчас в работе"
            action={(
              <Link href="/orders" className={styles.linkAction}>
                Показать все <FiArrowRight />
              </Link>
            )}
            contentClassName={styles.tableCardContent}
          >
            <EntityTableSurface variant="embedded" className={styles.tableSurface}>
              <Table className={cn(entityTableClassName, styles.table)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead className={styles.numericHead}>Дата</TableHead>
                    <TableHead className={styles.numericHead}>Сумма</TableHead>
                    <TableHead className={styles.numericHead}>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.recentOrders || []).length ? (
                    (stats?.recentOrders || []).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          {canOpenOrderCard ? (
                            <Link
                              href={`/orders/${order.id}`}
                              className={styles.tableLink}
                            >
                              #{order.id}
                            </Link>
                          ) : (
                            <span className={styles.tableLink}>#{order.id}</span>
                          )}
                        </TableCell>
                        <TableCell className={styles.textCell}>{order.client}</TableCell>
                        <TableCell className={styles.numericCell}>
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className={styles.numericCell}>
                          {formatCurrency(order.amount)}
                        </TableCell>
                        <TableCell className={styles.statusCell}>
                          <div className={styles.statusBadgeWrap}>
                            <EntityStatusBadge
                              value={order.status}
                              className={styles.statusBadge}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className={styles.emptyRowCell}>
                        <div className={styles.emptyRow}>Нет данных</div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
          </DashboardSectionCard>
        ) : null}

        {dashboardAccess.canWarehouseMovements ? (
          <DashboardSectionCard
            title="Движения по складу"
            description="Последние операции"
            action={(
              <Link href="/warehouse?tab=movements" className={styles.linkAction}>
                Показать все <FiArrowRight />
              </Link>
            )}
            contentClassName={styles.tableCardContent}
          >
            <EntityTableSurface variant="embedded" className={styles.tableSurface}>
              <Table className={cn(entityTableClassName, styles.table)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className={styles.numericHead}>Кол-во</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className={styles.numericHead}>Дата</TableHead>
                    <TableHead className={styles.numericHead}>Заказ</TableHead>
                    <TableHead className={styles.numericHead}>Закупка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.warehouseMovements || []).slice(0, 12).length ? (
                    (stats?.warehouseMovements || []).slice(0, 12).map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className={styles.textCell}>
                          <div className={styles.cellTitle}>{movement.product_name}</div>
                          {movement.comment ? (
                            <div className={styles.cellSub}>{movement.comment}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className={styles.numericCell}>
                          <span
                            className={cn(
                              styles.movementQty,
                              movement.operation_type === "приход"
                                ? styles.movementQtyIn
                                : styles.movementQtyOut
                            )}
                          >
                            {movement.operation_type === "приход" ? "+" : "-"}
                            {formatNumber(Math.abs(Number(movement.quantity) || 0))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              styles.movementBadge,
                              movement.operation_type === "приход"
                                ? styles.movementBadgeIn
                                : styles.movementBadgeOut
                            )}
                          >
                            {movement.operation_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.numericCell}>
                          {formatDate(movement.operation_date)}
                        </TableCell>
                        <TableCell className={styles.numericCell}>
                          {movement.order_id || "—"}
                        </TableCell>
                        <TableCell className={styles.numericCell}>
                          {movement.purchase_id || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className={styles.emptyRowCell}>
                        <div className={styles.emptyRow}>Нет данных</div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </EntityTableSurface>
          </DashboardSectionCard>
        ) : null}

        {dashboardAccess.canFinanceChart ||
        dashboardAccess.canTopProducts ||
        dashboardAccess.canTopClients ||
        dashboardAccess.canTransportPerformance ? (
          <div className={styles.extraGrid}>
            {dashboardAccess.canFinanceChart ? (
              <DashboardSectionCard
                title="Финансы"
                description="Выручка, расходы и прибыль по месяцам"
                action={(
                  <Link href="/reports?tab=overview" className={styles.linkAction}>
                    Открыть отчёты <FiArrowRight />
                  </Link>
                )}
                contentClassName={styles.chartContent}
              >
                {financeChartData.length ? (
                  <div className={styles.chartWrap}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={financeChartData}
                        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={chartAxisTick}
                          padding={{ left: 10, right: 10 }}
                          tickMargin={8}
                          minTickGap={12}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={chartAxisTick}
                          width={54}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: ChartTooltipValue, name) => [
                            formatCurrency(normalizeChartTooltipValue(value)),
                            String(name ?? ""),
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Выручка"
                          stroke="#111827"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="expense"
                          name="Расходы"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          name="Прибыль"
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={styles.emptyState}>Нет данных</div>
                )}
              </DashboardSectionCard>
            ) : null}

            {dashboardAccess.canTopProducts ? (
              <DashboardSectionCard
                title="Топ товары"
                description="По выручке за период"
                action={(
                  <Link href="/reports?tab=products" className={styles.linkAction}>
                    Открыть <FiArrowRight />
                  </Link>
                )}
                contentClassName={styles.tableCardContent}
              >
                <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Товар</TableHead>
                        <TableHead className={styles.numericHead}>Шт.</TableHead>
                        <TableHead className={styles.numericHead}>Выручка</TableHead>
                        <TableHead className={styles.numericHead}>Маржа %</TableHead>
                        <TableHead className={styles.numericHead}>Тренд %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(topProducts || []).length ? (
                        (topProducts || []).map((row) => (
                          <TableRow key={row.product_id}>
                            <TableCell className={styles.textCell}>
                              <div className={styles.cellTitle}>{row.product_name}</div>
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.sold_units)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatCurrency(row.revenue)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.margin_percent)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.trend_percent)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className={styles.emptyRowCell}>
                            <div className={styles.emptyRow}>Нет данных</div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              </DashboardSectionCard>
            ) : null}

            {dashboardAccess.canTopClients ? (
              <DashboardSectionCard
                title="Топ клиенты"
                description="По выручке за период"
                action={(
                  <Link href="/reports?tab=clients" className={styles.linkAction}>
                    Открыть <FiArrowRight />
                  </Link>
                )}
                contentClassName={styles.tableCardContent}
              >
                <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Клиент</TableHead>
                        <TableHead className={styles.numericHead}>Заказов</TableHead>
                        <TableHead className={styles.numericHead}>Выручка</TableHead>
                        <TableHead className={styles.numericHead}>Средний чек</TableHead>
                        <TableHead className={styles.numericHead}>Рост %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(topClients || []).length ? (
                        (topClients || []).map((row) => (
                          <TableRow key={row.client_id}>
                            <TableCell className={styles.textCell}>
                              <div className={styles.cellTitle}>{row.client_name}</div>
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.orders_count)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatCurrency(row.revenue)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatCurrency(row.avg_check)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.growth_percent)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className={styles.emptyRowCell}>
                            <div className={styles.emptyRow}>Нет данных</div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              </DashboardSectionCard>
            ) : null}

            {dashboardAccess.canTransportPerformance ? (
              <DashboardSectionCard
                title="Логистика"
                description="Эффективность транспортных компаний"
                action={(
                  <Link href="/reports?tab=logistics" className={styles.linkAction}>
                    Открыть <FiArrowRight />
                  </Link>
                )}
                contentClassName={styles.tableCardContent}
              >
                <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                  <Table className={cn(entityTableClassName, styles.table)}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ТК</TableHead>
                        <TableHead className={styles.numericHead}>Отгрузок</TableHead>
                        <TableHead className={styles.numericHead}>Вовремя</TableHead>
                        <TableHead className={styles.numericHead}>Рейтинг %</TableHead>
                        <TableHead className={styles.numericHead}>Ср. стоимость</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(transport || []).length ? (
                        (transport || []).map((row) => (
                          <TableRow key={row.transport_id}>
                            <TableCell className={styles.textCell}>
                              <div className={styles.cellTitle}>{row.transport_name}</div>
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.shipments)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.on_time)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatNumber(row.rating_percent)}
                            </TableCell>
                            <TableCell className={styles.numericCell}>
                              {formatCurrency(row.avg_cost)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className={styles.emptyRowCell}>
                            <div className={styles.emptyRow}>Нет данных</div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </EntityTableSurface>
              </DashboardSectionCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

const Home: NextPage = (): JSX.Element => <DashboardPage />

export default withLayout(Home)
